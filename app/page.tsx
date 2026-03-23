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
      padding: '20px',
      paddingTop: 'calc(20px - 40px)'
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
        alignItems: 'center',
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
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '32px',
          marginTop: '32px',
          padding: '16px',
          alignItems: 'center'
        }}>
          {/* For kids */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'center',
            textAlign: 'center'
          }}>
            <span style={{
              fontSize: '16px',
              fontWeight: '400',
              margin: '0 0 4px 0',
              color: 'inherit',
              fontFamily: 'var(--font-mono), monospace',
              opacity: 0.7
            }}>
              For kids
            </span>
            <a
              href="https://j7sup.com/lineartcreator"
              style={{
                fontSize: '16px',
                color: 'inherit',
                opacity: 0.7,
                fontFamily: 'var(--font-mono), monospace',
                textDecoration: 'underline',
                textUnderlineOffset: '0.18em',
                whiteSpace: 'nowrap'
              }}
              target="_blank"
              rel="noopener noreferrer"
            >
              Line art creator
            </a>
            <a
              href="https://j7sup.com/magicpaper"
              style={{
                fontSize: '16px',
                color: 'inherit',
                opacity: 0.7,
                fontFamily: 'var(--font-mono), monospace',
                textDecoration: 'underline',
                textUnderlineOffset: '0.18em',
                whiteSpace: 'nowrap'
              }}
              target="_blank"
              rel="noopener noreferrer"
            >
              Magic paper toys
            </a>
          </div>

          {/* For AI Workflow */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'center',
            textAlign: 'center'
          }}>
            <span style={{
              fontSize: '16px',
              fontWeight: '400',
              margin: '0 0 4px 0',
              color: 'inherit',
              fontFamily: 'var(--font-mono), monospace',
              opacity: 0.7
            }}>
              For AI Workflow
            </span>
            <a
              href="https://skills.sh/j7supreme/design-system-skills/design-system-governance-workflow"
              style={{
                fontSize: '16px',
                color: 'inherit',
                opacity: 0.7,
                fontFamily: 'var(--font-mono), monospace',
                textDecoration: 'underline',
                textUnderlineOffset: '0.18em',
                whiteSpace: 'nowrap'
              }}
              target="_blank"
              rel="noopener noreferrer"
            >
              Agent skill: Design system governance workflow
            </a>
            <a
              href="https://www.npmjs.com/package/@j7supreme/skill-dashboard"
              style={{
                fontSize: '16px',
                color: 'inherit',
                opacity: 0.7,
                fontFamily: 'var(--font-mono), monospace',
                textDecoration: 'underline',
                textUnderlineOffset: '0.18em',
                whiteSpace: 'nowrap'
              }}
              target="_blank"
              rel="noopener noreferrer"
            >
              Skill dashboard for agents
            </a>
          </div>
        </div>
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
