import { mount } from 'svelte';
import Landing from './Landing.svelte';
import './styles.css';

const target = document.getElementById('app');
if (target) {
  mount(Landing, { target });
}
