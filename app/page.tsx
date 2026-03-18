"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <main style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100dvh',
      backgroundColor: 'var(--bg-main)',
      color: 'var(--text-main)',
      fontFamily: 'var(--font-body), sans-serif',
      textAlign: 'center',
      padding: '20px'
    }}>
      <img
        src="/logo.png"
        alt="Logo"
        style={{
          width: '72px',
          height: '72px',
          marginBottom: '32px',
          filter: 'var(--logo-filter)'
        }}
      />
      
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        <h1 style={{
          fontSize: '40px',
          fontWeight: '400',
          margin: 0,
          letterSpacing: '-0.02em',
          fontFamily: 'var(--font-mono), monospace'
        }}>
          J7 Sup reme
        </h1>
        <p style={{
          fontSize: '16px',
          margin: 0,
          opacity: 0.7,
          fontFamily: 'var(--font-mono), monospace'
        }}>
          Built by James Hou
        </p>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          --bg-main: #ffffff;
          --text-main: #000000;
          --logo-filter: none;
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --bg-main: #000000;
            --text-main: #ffffff;
            --logo-filter: invert(1);
          }
        }
      `}} />
    </main>
  );
}
