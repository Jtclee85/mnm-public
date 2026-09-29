import Image from 'next/image';
import titleLogo from '../public/title-mnm.png';
import { getUiText } from '../lib/i18n';

const Banner = ({ t = getUiText('ko') }) => {
  return (
    <div style={{
      width: '100%',
      borderRadius: '12px',
      marginBottom: '1.5rem',
      textAlign: 'center',
      color: 'var(--color-text)',
      padding: '20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <style>{`
        .mnm-title-logo { width: 100%; max-width: 320px; height: auto; }
        @media (max-width: 640px) { .mnm-title-logo { max-width: 240px; } }
      `}</style>
      <h1 style={{ margin: 0, lineHeight: 0 }}>
        <Image
          src={titleLogo}
          alt="뭐냐면"
          priority
          className="mnm-title-logo"
          sizes="(max-width: 640px) 240px, 320px"
        />
      </h1>
      <p style={{ fontSize: '1rem', color: 'var(--color-text)', margin: '10px 0 0 0', fontWeight: 700 }}>
        {t.bannerSubtitle}
      </p>
      <p style={{ fontSize: '0.9rem', color: 'var(--color-text-sub)', margin: '3px 0 0 0' }}>
        {t.bannerDescription}
      </p>
    </div>
  );
};

export default Banner;
