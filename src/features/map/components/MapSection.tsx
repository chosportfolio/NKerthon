function MapSection() {
  return (
    <section className="feature-page map-page">
      <div className="feature-title">
        <span>건국대학교 글로컬캠퍼스</span>
        <h2>캠퍼스 지도</h2>
      </div>
      <div className="map-canvas" aria-label="캠퍼스 지도 영역">
        <div className="map-road road-one"></div>
        <div className="map-road road-two"></div>
        <span className="building building-a">신공학관</span>
        <span className="building building-b">학생회관</span>
        <span className="building building-c">도서관</span>
        <span className="current-location">●<small>현재 위치</small></span>
      </div>
      <div className="map-search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
        <input type="search" placeholder="건물이나 강의실을 검색하세요" />
      </div>
    </section>
  )
}

export default MapSection
