//! GPU backend detection and management
//!
//! Handles detection of available GPU acceleration backends (CUDA, Metal)
//! and provides fallback to CPU when GPU is unavailable.

use serde::{Deserialize, Serialize};

/// Available GPU backends for Whisper inference
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum GpuBackend {
    /// NVIDIA CUDA backend
    Cuda { device_name: String, vram_mb: u64 },
    /// Apple Metal backend (Apple Silicon)
    Metal {
        device_name: String,
        is_apple_silicon: bool,
    },
    /// CPU-only backend (fallback)
    Cpu,
}

impl GpuBackend {
    /// Check if this backend uses GPU acceleration
    pub fn is_gpu(&self) -> bool {
        !matches!(self, GpuBackend::Cpu)
    }

    /// Get the backend name for display
    pub fn name(&self) -> &str {
        match self {
            GpuBackend::Cuda { .. } => "CUDA",
            GpuBackend::Metal { .. } => "Metal",
            GpuBackend::Cpu => "CPU",
        }
    }
}

impl Default for GpuBackend {
    fn default() -> Self {
        detect_gpu_backend()
    }
}

/// GPU information for display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuInfo {
    pub backend: GpuBackend,
    pub available: bool,
    pub in_use: bool,
}

/// Detect the best available GPU backend
pub fn detect_gpu_backend() -> GpuBackend {
    // Try CUDA first (Windows/Linux)
    #[cfg(feature = "cuda")]
    {
        if let Some(info) = detect_cuda_device() {
            tracing::info!(
                "Detected CUDA GPU: {} ({} MB VRAM)",
                info.name,
                info.vram_mb
            );
            return GpuBackend::Cuda {
                device_name: info.name,
                vram_mb: info.vram_mb,
            };
        }
    }

    // Try Metal (macOS)
    #[cfg(feature = "metal")]
    {
        if let Some(info) = detect_metal_device() {
            tracing::info!("Detected Metal GPU: {}", info.name);
            return GpuBackend::Metal {
                device_name: info.name,
                is_apple_silicon: info.is_apple_silicon,
            };
        }
    }

    tracing::info!("No GPU acceleration available, using CPU");
    GpuBackend::Cpu
}

/// Check if GPU acceleration is available
pub fn is_gpu_available() -> bool {
    !matches!(detect_gpu_backend(), GpuBackend::Cpu)
}

// CUDA detection (Windows/Linux only)
#[cfg(feature = "cuda")]
struct CudaDeviceInfo {
    name: String,
    vram_mb: u64,
}

#[cfg(feature = "cuda")]
fn detect_cuda_device() -> Option<CudaDeviceInfo> {
    // Try to detect CUDA device using nvidia-smi
    // This is a portable way that works without linking to CUDA directly
    let output = std::process::Command::new("nvidia-smi")
        .args([
            "--query-gpu=name,memory.total",
            "--format=csv,noheader,nounits",
        ])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let line = stdout.lines().next()?;
    let parts: Vec<&str> = line.split(", ").collect();

    if parts.len() >= 2 {
        let name = parts[0].trim().to_string();
        let vram_mb = parts[1].trim().parse().unwrap_or(0);
        Some(CudaDeviceInfo { name, vram_mb })
    } else {
        None
    }
}

// Metal detection (macOS only)
#[cfg(feature = "metal")]
struct MetalDeviceInfo {
    name: String,
    is_apple_silicon: bool,
}

#[cfg(feature = "metal")]
fn detect_metal_device() -> Option<MetalDeviceInfo> {
    // Check if we're on Apple Silicon
    let is_apple_silicon = detect_apple_silicon();

    if is_apple_silicon {
        // Get chip name
        let name = get_apple_chip_name().unwrap_or_else(|| "Apple Silicon GPU".to_string());
        Some(MetalDeviceInfo {
            name,
            is_apple_silicon: true,
        })
    } else {
        // Intel Mac - Metal might still be available but with limited benefit
        None
    }
}

#[cfg(target_os = "macos")]
fn detect_apple_silicon() -> bool {
    let output = std::process::Command::new("sysctl")
        .args(["-n", "machdep.cpu.brand_string"])
        .output()
        .ok();

    output
        .map(|o| String::from_utf8_lossy(&o.stdout).contains("Apple"))
        .unwrap_or(false)
}

#[cfg(not(target_os = "macos"))]
fn detect_apple_silicon() -> bool {
    false
}

#[cfg(target_os = "macos")]
fn get_apple_chip_name() -> Option<String> {
    let output = std::process::Command::new("sysctl")
        .args(["-n", "machdep.cpu.brand_string"])
        .output()
        .ok()?;

    let name = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if name.is_empty() {
        None
    } else {
        Some(name)
    }
}

#[cfg(not(target_os = "macos"))]
fn get_apple_chip_name() -> Option<String> {
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gpu_backend_is_gpu() {
        assert!(!GpuBackend::Cpu.is_gpu());

        let cuda = GpuBackend::Cuda {
            device_name: "Test".into(),
            vram_mb: 8192,
        };
        assert!(cuda.is_gpu());

        let metal = GpuBackend::Metal {
            device_name: "Test".into(),
            is_apple_silicon: true,
        };
        assert!(metal.is_gpu());
    }

    #[test]
    fn test_gpu_backend_name() {
        assert_eq!(GpuBackend::Cpu.name(), "CPU");

        let cuda = GpuBackend::Cuda {
            device_name: "RTX 3080".into(),
            vram_mb: 10240,
        };
        assert_eq!(cuda.name(), "CUDA");
    }

    #[test]
    fn test_gpu_backend_serialization() {
        let cpu = GpuBackend::Cpu;
        let json = serde_json::to_string(&cpu).unwrap();
        assert!(json.contains("cpu"));

        let cuda = GpuBackend::Cuda {
            device_name: "RTX 3080".into(),
            vram_mb: 10240,
        };
        let json = serde_json::to_string(&cuda).unwrap();
        assert!(json.contains("cuda"));
        assert!(json.contains("RTX 3080"));
    }

    #[test]
    fn test_detect_gpu_backend_returns_valid() {
        // This just verifies the function runs without panic
        let backend = detect_gpu_backend();
        // Should return some valid backend
        assert!(!backend.name().is_empty());
    }

    #[test]
    fn test_gpu_info_serialization() {
        let info = GpuInfo {
            backend: GpuBackend::Cpu,
            available: false,
            in_use: false,
        };
        let json = serde_json::to_string(&info).unwrap();
        let parsed: GpuInfo = serde_json::from_str(&json).unwrap();
        assert!(!parsed.available);
        assert!(!parsed.in_use);
    }

    #[test]
    fn test_is_gpu_available() {
        // Just verify it runs without panic
        let _ = is_gpu_available();
    }

    #[test]
    fn test_gpu_backend_default() {
        let backend = GpuBackend::default();
        // Should match detect_gpu_backend result
        assert_eq!(backend.name(), detect_gpu_backend().name());
    }

    #[test]
    fn test_metal_backend_properties() {
        let metal = GpuBackend::Metal {
            device_name: "Apple M1 Pro".into(),
            is_apple_silicon: true,
        };
        assert!(metal.is_gpu());
        assert_eq!(metal.name(), "Metal");
    }

    #[test]
    fn test_metal_serialization() {
        let metal = GpuBackend::Metal {
            device_name: "Apple M2 Max".into(),
            is_apple_silicon: true,
        };
        let json = serde_json::to_string(&metal).unwrap();
        assert!(json.contains("metal"));
        assert!(json.contains("Apple M2 Max"));
        assert!(json.contains("is_apple_silicon"));

        let parsed: GpuBackend = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.name(), "Metal");
    }

    #[test]
    fn test_apple_silicon_detection_runs() {
        // Just verify the function runs without panic on any platform
        let _ = detect_apple_silicon();
    }

    #[test]
    fn test_get_apple_chip_name_runs() {
        // Just verify the function runs without panic on any platform
        let _ = get_apple_chip_name();
    }
}
