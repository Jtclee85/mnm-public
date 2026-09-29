import { useEffect } from 'react';
import '../styles/globals.css';
import { playClick } from '../lib/sounds';

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    const handleClick = (e) => {
      const btn = e.target.closest('button');
      if (btn && !btn.disabled) playClick();
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return <Component {...pageProps} />;
}

export default MyApp;
