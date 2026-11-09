import Head from 'next/head';
import ReactMarkdown from 'react-markdown';
import { PRIVACY_PAGE_TEXT as T } from '../lib/privacyPolicy';
import styles from '../styles/PrivacyPolicy.module.css';

// 제공받은 한국어 문안을 그대로 표시한다. 표만 별도 렌더링해 새 Markdown 의존성을 추가하지 않는다.
export default function PrivacyPage({ blocks }) {
  return (
    <>
      <Head>
        <title>{T.title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <main lang="ko" className={styles.page}>
        <nav className={styles.navigation}>
          <a href={T.studentHref}>{T.studentLabel}</a>
          <a href={T.teacherHref}>{T.teacherLabel}</a>
        </nav>
        <article className={styles.article} data-testid="privacy-policy-content">
          {blocks.map((block, index) => block.type === 'table' ? (
            <div key={index} className={styles.tableScroll} role="region" aria-label="처리 목적과 항목" tabIndex={0}>
              <table>
                <caption>처리 목적과 항목</caption>
                <thead><tr>{block.headers.map((cell, i) => <th key={i} scope="col">{cell}</th>)}</tr></thead>
                <tbody>{block.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody>
              </table>
            </div>
          ) : <ReactMarkdown
            key={index}
            components={{
              a: ({ node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
            }}
          >{block.text}</ReactMarkdown>)}
        </article>
      </main>
    </>
  );
}

export async function getStaticProps() {
  // 온라인 운영자 정보가 USB 제출물에 들어가지 않게 오프라인 export에서는 페이지를 만들지 않는다.
  if (process.env.NEXT_PUBLIC_OFFLINE_DEMO_MODE === 'true') return { notFound: true };
  const fs = require('fs');
  const path = require('path');
  const file = path.join(process.cwd(), 'content', 'privacy-policy.md');
  // 공개용 방침을 제외한 제출 소스에서도 오프라인 빌드는 유지한다.
  if (!fs.existsSync(file)) return { notFound: true };
  const source = fs.readFileSync(file, 'utf8');
  const blocks = [];
  let markdown = [];
  let table = [];
  const flushMarkdown = () => {
    if (markdown.length) blocks.push({ type: 'markdown', text: markdown.join('\n') });
    markdown = [];
  };
  const flushTable = () => {
    if (!table.length) return;
    const cells = line => line.trim().slice(1, -1).split('|').map(cell => cell.trim());
    blocks.push({ type: 'table', headers: cells(table[0]), rows: table.slice(2).map(cells) });
    table = [];
  };
  for (const line of source.split('\n')) {
    if (line.trim().startsWith('|')) { flushMarkdown(); table.push(line); }
    else { flushTable(); markdown.push(line); }
  }
  flushTable(); flushMarkdown();
  return { props: { blocks } };
}
