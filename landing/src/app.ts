import { mount } from 'svelte';
import Landing from './Landing.svelte';
import './styles.css';

const app = mount(Landing, {
  target: document.getElementById('app')!,
});

export default app;
