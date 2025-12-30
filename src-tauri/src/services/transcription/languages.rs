//! Whisper supported languages
//!
//! Complete list of all languages supported by Whisper for transcription.

use serde::{Deserialize, Serialize};

/// A supported language
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Language {
    /// ISO 639-1 language code
    pub code: &'static str,
    /// English name
    pub name: &'static str,
    /// Native name (if different)
    pub native_name: Option<&'static str>,
    /// Whether this is a commonly used language (shown first)
    pub common: bool,
}

/// All Whisper-supported languages (99 languages)
pub const LANGUAGES: &[Language] = &[
    // Common languages (shown first in UI)
    Language {
        code: "en",
        name: "English",
        native_name: None,
        common: true,
    },
    Language {
        code: "es",
        name: "Spanish",
        native_name: Some("Español"),
        common: true,
    },
    Language {
        code: "zh",
        name: "Chinese",
        native_name: Some("中文"),
        common: true,
    },
    Language {
        code: "de",
        name: "German",
        native_name: Some("Deutsch"),
        common: true,
    },
    Language {
        code: "fr",
        name: "French",
        native_name: Some("Français"),
        common: true,
    },
    Language {
        code: "ja",
        name: "Japanese",
        native_name: Some("日本語"),
        common: true,
    },
    Language {
        code: "ko",
        name: "Korean",
        native_name: Some("한국어"),
        common: true,
    },
    Language {
        code: "pt",
        name: "Portuguese",
        native_name: Some("Português"),
        common: true,
    },
    Language {
        code: "ru",
        name: "Russian",
        native_name: Some("Русский"),
        common: true,
    },
    Language {
        code: "ar",
        name: "Arabic",
        native_name: Some("العربية"),
        common: true,
    },
    Language {
        code: "hi",
        name: "Hindi",
        native_name: Some("हिन्दी"),
        common: true,
    },
    Language {
        code: "it",
        name: "Italian",
        native_name: Some("Italiano"),
        common: true,
    },
    // All other languages (alphabetical)
    Language {
        code: "af",
        name: "Afrikaans",
        native_name: None,
        common: false,
    },
    Language {
        code: "sq",
        name: "Albanian",
        native_name: Some("Shqip"),
        common: false,
    },
    Language {
        code: "am",
        name: "Amharic",
        native_name: Some("አማርኛ"),
        common: false,
    },
    Language {
        code: "hy",
        name: "Armenian",
        native_name: Some("Հայերdelays"),
        common: false,
    },
    Language {
        code: "as",
        name: "Assamese",
        native_name: Some("অসমীয়া"),
        common: false,
    },
    Language {
        code: "az",
        name: "Azerbaijani",
        native_name: Some("Azərbaycan"),
        common: false,
    },
    Language {
        code: "ba",
        name: "Bashkir",
        native_name: Some("Башҡорт"),
        common: false,
    },
    Language {
        code: "eu",
        name: "Basque",
        native_name: Some("Euskara"),
        common: false,
    },
    Language {
        code: "be",
        name: "Belarusian",
        native_name: Some("Беларуская"),
        common: false,
    },
    Language {
        code: "bn",
        name: "Bengali",
        native_name: Some("বাংলা"),
        common: false,
    },
    Language {
        code: "bs",
        name: "Bosnian",
        native_name: Some("Bosanski"),
        common: false,
    },
    Language {
        code: "br",
        name: "Breton",
        native_name: Some("Brezhoneg"),
        common: false,
    },
    Language {
        code: "bg",
        name: "Bulgarian",
        native_name: Some("Български"),
        common: false,
    },
    Language {
        code: "my",
        name: "Burmese",
        native_name: Some("မြန်မာ"),
        common: false,
    },
    Language {
        code: "ca",
        name: "Catalan",
        native_name: Some("Català"),
        common: false,
    },
    Language {
        code: "hr",
        name: "Croatian",
        native_name: Some("Hrvatski"),
        common: false,
    },
    Language {
        code: "cs",
        name: "Czech",
        native_name: Some("Čeština"),
        common: false,
    },
    Language {
        code: "da",
        name: "Danish",
        native_name: Some("Dansk"),
        common: false,
    },
    Language {
        code: "nl",
        name: "Dutch",
        native_name: Some("Nederlands"),
        common: false,
    },
    Language {
        code: "et",
        name: "Estonian",
        native_name: Some("Eesti"),
        common: false,
    },
    Language {
        code: "fo",
        name: "Faroese",
        native_name: Some("Føroyskt"),
        common: false,
    },
    Language {
        code: "fi",
        name: "Finnish",
        native_name: Some("Suomi"),
        common: false,
    },
    Language {
        code: "gl",
        name: "Galician",
        native_name: Some("Galego"),
        common: false,
    },
    Language {
        code: "ka",
        name: "Georgian",
        native_name: Some("ქართული"),
        common: false,
    },
    Language {
        code: "el",
        name: "Greek",
        native_name: Some("Ελληνικά"),
        common: false,
    },
    Language {
        code: "gu",
        name: "Gujarati",
        native_name: Some("ગુજરાતી"),
        common: false,
    },
    Language {
        code: "ht",
        name: "Haitian Creole",
        native_name: Some("Kreyòl Ayisyen"),
        common: false,
    },
    Language {
        code: "ha",
        name: "Hausa",
        native_name: None,
        common: false,
    },
    Language {
        code: "haw",
        name: "Hawaiian",
        native_name: Some("ʻŌlelo Hawaiʻi"),
        common: false,
    },
    Language {
        code: "he",
        name: "Hebrew",
        native_name: Some("עברית"),
        common: false,
    },
    Language {
        code: "hu",
        name: "Hungarian",
        native_name: Some("Magyar"),
        common: false,
    },
    Language {
        code: "is",
        name: "Icelandic",
        native_name: Some("Íslenska"),
        common: false,
    },
    Language {
        code: "id",
        name: "Indonesian",
        native_name: Some("Bahasa Indonesia"),
        common: false,
    },
    Language {
        code: "ga",
        name: "Irish",
        native_name: Some("Gaeilge"),
        common: false,
    },
    Language {
        code: "jw",
        name: "Javanese",
        native_name: Some("Basa Jawa"),
        common: false,
    },
    Language {
        code: "kn",
        name: "Kannada",
        native_name: Some("ಕನ್ನಡ"),
        common: false,
    },
    Language {
        code: "kk",
        name: "Kazakh",
        native_name: Some("Қазақ"),
        common: false,
    },
    Language {
        code: "km",
        name: "Khmer",
        native_name: Some("ភាសាខ្មែរ"),
        common: false,
    },
    Language {
        code: "ky",
        name: "Kyrgyz",
        native_name: Some("Кыргызча"),
        common: false,
    },
    Language {
        code: "lo",
        name: "Lao",
        native_name: Some("ລາວ"),
        common: false,
    },
    Language {
        code: "la",
        name: "Latin",
        native_name: Some("Latina"),
        common: false,
    },
    Language {
        code: "lv",
        name: "Latvian",
        native_name: Some("Latviešu"),
        common: false,
    },
    Language {
        code: "ln",
        name: "Lingala",
        native_name: Some("Lingála"),
        common: false,
    },
    Language {
        code: "lt",
        name: "Lithuanian",
        native_name: Some("Lietuvių"),
        common: false,
    },
    Language {
        code: "lb",
        name: "Luxembourgish",
        native_name: Some("Lëtzebuergesch"),
        common: false,
    },
    Language {
        code: "mk",
        name: "Macedonian",
        native_name: Some("Македонски"),
        common: false,
    },
    Language {
        code: "mg",
        name: "Malagasy",
        native_name: Some("Malagasy"),
        common: false,
    },
    Language {
        code: "ms",
        name: "Malay",
        native_name: Some("Bahasa Melayu"),
        common: false,
    },
    Language {
        code: "ml",
        name: "Malayalam",
        native_name: Some("മലയാളം"),
        common: false,
    },
    Language {
        code: "mt",
        name: "Maltese",
        native_name: Some("Malti"),
        common: false,
    },
    Language {
        code: "mi",
        name: "Maori",
        native_name: Some("Te Reo Māori"),
        common: false,
    },
    Language {
        code: "mr",
        name: "Marathi",
        native_name: Some("मराठी"),
        common: false,
    },
    Language {
        code: "mn",
        name: "Mongolian",
        native_name: Some("Монгол"),
        common: false,
    },
    Language {
        code: "ne",
        name: "Nepali",
        native_name: Some("नेपाली"),
        common: false,
    },
    Language {
        code: "no",
        name: "Norwegian",
        native_name: Some("Norsk"),
        common: false,
    },
    Language {
        code: "nn",
        name: "Nynorsk",
        native_name: Some("Nynorsk"),
        common: false,
    },
    Language {
        code: "oc",
        name: "Occitan",
        native_name: Some("Occitan"),
        common: false,
    },
    Language {
        code: "ps",
        name: "Pashto",
        native_name: Some("پښتو"),
        common: false,
    },
    Language {
        code: "fa",
        name: "Persian",
        native_name: Some("فارسی"),
        common: false,
    },
    Language {
        code: "pl",
        name: "Polish",
        native_name: Some("Polski"),
        common: false,
    },
    Language {
        code: "pa",
        name: "Punjabi",
        native_name: Some("ਪੰਜਾਬੀ"),
        common: false,
    },
    Language {
        code: "ro",
        name: "Romanian",
        native_name: Some("Română"),
        common: false,
    },
    Language {
        code: "sa",
        name: "Sanskrit",
        native_name: Some("संस्कृतम्"),
        common: false,
    },
    Language {
        code: "sr",
        name: "Serbian",
        native_name: Some("Српски"),
        common: false,
    },
    Language {
        code: "sn",
        name: "Shona",
        native_name: Some("chiShona"),
        common: false,
    },
    Language {
        code: "sd",
        name: "Sindhi",
        native_name: Some("سنڌي"),
        common: false,
    },
    Language {
        code: "si",
        name: "Sinhala",
        native_name: Some("සිංහල"),
        common: false,
    },
    Language {
        code: "sk",
        name: "Slovak",
        native_name: Some("Slovenčina"),
        common: false,
    },
    Language {
        code: "sl",
        name: "Slovenian",
        native_name: Some("Slovenščina"),
        common: false,
    },
    Language {
        code: "so",
        name: "Somali",
        native_name: Some("Soomaali"),
        common: false,
    },
    Language {
        code: "su",
        name: "Sundanese",
        native_name: Some("Basa Sunda"),
        common: false,
    },
    Language {
        code: "sw",
        name: "Swahili",
        native_name: Some("Kiswahili"),
        common: false,
    },
    Language {
        code: "sv",
        name: "Swedish",
        native_name: Some("Svenska"),
        common: false,
    },
    Language {
        code: "tl",
        name: "Tagalog",
        native_name: Some("Tagalog"),
        common: false,
    },
    Language {
        code: "tg",
        name: "Tajik",
        native_name: Some("Тоҷикӣ"),
        common: false,
    },
    Language {
        code: "ta",
        name: "Tamil",
        native_name: Some("தமிழ்"),
        common: false,
    },
    Language {
        code: "tt",
        name: "Tatar",
        native_name: Some("Татар"),
        common: false,
    },
    Language {
        code: "te",
        name: "Telugu",
        native_name: Some("తెలుగు"),
        common: false,
    },
    Language {
        code: "th",
        name: "Thai",
        native_name: Some("ไทย"),
        common: false,
    },
    Language {
        code: "bo",
        name: "Tibetan",
        native_name: Some("བོད་སྐད"),
        common: false,
    },
    Language {
        code: "tr",
        name: "Turkish",
        native_name: Some("Türkçe"),
        common: false,
    },
    Language {
        code: "tk",
        name: "Turkmen",
        native_name: Some("Türkmençe"),
        common: false,
    },
    Language {
        code: "uk",
        name: "Ukrainian",
        native_name: Some("Українська"),
        common: false,
    },
    Language {
        code: "ur",
        name: "Urdu",
        native_name: Some("اردو"),
        common: false,
    },
    Language {
        code: "uz",
        name: "Uzbek",
        native_name: Some("O'zbek"),
        common: false,
    },
    Language {
        code: "vi",
        name: "Vietnamese",
        native_name: Some("Tiếng Việt"),
        common: false,
    },
    Language {
        code: "cy",
        name: "Welsh",
        native_name: Some("Cymraeg"),
        common: false,
    },
    Language {
        code: "yi",
        name: "Yiddish",
        native_name: Some("ייִדיש"),
        common: false,
    },
    Language {
        code: "yo",
        name: "Yoruba",
        native_name: Some("Yorùbá"),
        common: false,
    },
];

/// Get all languages sorted by common status then alphabetically
pub fn get_languages() -> Vec<Language> {
    let mut langs: Vec<_> = LANGUAGES.to_vec();
    langs.sort_by(|a, b| {
        // Common languages first, then alphabetical by name
        b.common.cmp(&a.common).then(a.name.cmp(b.name))
    });
    langs
}

/// Validate a language code
pub fn is_valid_language_code(code: &str) -> bool {
    LANGUAGES.iter().any(|l| l.code == code)
}

/// Get language by code
pub fn get_language_by_code(code: &str) -> Option<&'static Language> {
    LANGUAGES.iter().find(|l| l.code == code)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_languages_list_not_empty() {
        assert!(!LANGUAGES.is_empty());
        assert!(LANGUAGES.len() >= 90);
    }

    #[test]
    fn test_common_languages_exist() {
        let common: Vec<_> = LANGUAGES.iter().filter(|l| l.common).collect();
        assert!(common.len() >= 10);
        assert!(common.iter().any(|l| l.code == "en"));
        assert!(common.iter().any(|l| l.code == "es"));
        assert!(common.iter().any(|l| l.code == "zh"));
    }

    #[test]
    fn test_get_languages_sorted() {
        let langs = get_languages();
        // First 12 should be common languages
        assert!(langs[0].common);
        // After common, should be alphabetical
        let non_common: Vec<_> = langs.iter().filter(|l| !l.common).collect();
        for window in non_common.windows(2) {
            assert!(window[0].name <= window[1].name);
        }
    }

    #[test]
    fn test_valid_language_code() {
        assert!(is_valid_language_code("en"));
        assert!(is_valid_language_code("es"));
        assert!(!is_valid_language_code("invalid"));
        assert!(!is_valid_language_code(""));
    }

    #[test]
    fn test_get_language_by_code() {
        let en = get_language_by_code("en").unwrap();
        assert_eq!(en.name, "English");
        assert!(en.common);

        assert!(get_language_by_code("invalid").is_none());
    }
}
