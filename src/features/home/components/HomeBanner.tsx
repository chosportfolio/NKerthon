import everyuneezBanner from '../../../assets/everyuneez_rebranding_banner.jpg'

function HomeBanner() {
  return (
    <section className="home-promo-banner" aria-label="대학생 복지몰 배너">
      <a
        href="https://www.univstore.com/main"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="대학생 복지몰 새 창으로 열기"
      >
        <img src={everyuneezBanner} alt="에브리유니즈 대학생 복지몰" />
      </a>
    </section>
  )
}

export default HomeBanner
