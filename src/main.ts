import './style.css';
import { createGreeting } from './greeting.ts';

const app = document.querySelector<HTMLDivElement>('#app');

if (app) {
  const heading = document.createElement('h1');
  heading.textContent = createGreeting('推し旅');
  app.append(heading);
}
