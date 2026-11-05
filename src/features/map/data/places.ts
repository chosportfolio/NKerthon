// 캠퍼스 주변 장소 데이터 (엑셀 변환본). 좌표: 네이버 Geocoding 주소 검색 결과 (2026-10-02).
// 같은 주소의 가게는 같은 건물 좌표를 공유하며, 개별 출입구 위치와 다를 수 있다.

export type PlaceCategory = "건물" | "시설" | "기타생활" | "기타오락" | "밥집" | "술집" | "카페" | "편의점";

export type Place = {
  id: string;
  name: string;
  category: PlaceCategory;
  lat: number | null;
  lng: number | null;
  address: string;
  hours: string;
  phone: string;
  description: string;
  source: string;
};

export const CATEGORIES: PlaceCategory[] = ["기타생활", "기타오락", "밥집", "술집", "카페", "편의점"];

export const PLACES: Place[] = [
  { id: "p001", name: "지포차", category: "술집", lat: 36.9484379, lng: 127.9049972, address: "충북 충주시 충열5길 32", hours: "18:00~ 새벽03:00", phone: "010-2781-5501", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p002", name: "단월정", category: "술집", lat: 36.9483982, lng: 127.9047794, address: "충북 충주시 충열5길 30 2층", hours: "18:00~새벽 04:00", phone: "0507-1385-9413", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p003", name: "이중식탁", category: "밥집", lat: 36.9483982, lng: 127.9047794, address: "충북 충주시 충열5길 30 1층", hours: "10:00~21:00", phone: "0507-1337-7797", description: "토요일 정기휴무", source: "학교_주변_매장_정보.xlsx" },
  { id: "p004", name: "건대주먹밥", category: "밥집", lat: 36.9483876, lng: 127.9045749, address: "충북 충주시 충열5길 28", hours: "09:00~19:00", phone: "043-845-5060", description: "주말 휴무", source: "학교_주변_매장_정보.xlsx" },
  { id: "p005", name: "대박분식", category: "밥집", lat: 36.9489752, lng: 127.9043443, address: "충북 충주시 충열5길 23", hours: "09:00~21:00", phone: "", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p006", name: "지뎅", category: "밥집", lat: 36.9490728, lng: 127.9041112, address: "충북 충주시 충열5길 22 1층", hours: "09:00~", phone: "043-843-3005", description: "사장님 상황따라 유동적으로 오픈 및 마감", source: "학교_주변_매장_정보.xlsx" },
  { id: "p007", name: "면식당 충주건국대점", category: "밥집", lat: 36.9490728, lng: 127.9041112, address: "충북 충주시 충열5길 22 1층 면식당", hours: "11:00~20:30", phone: "0507-1333-4678", description: "라스트오더 20:00", source: "학교_주변_매장_정보.xlsx" },
  { id: "p008", name: "아러이", category: "밥집", lat: 36.9490995, lng: 127.9043993, address: "충북 충주시 충열5길 21 1층", hours: "11:00~20:00", phone: "0507-1356-3254", description: "라스트오더 19:30", source: "학교_주변_매장_정보.xlsx" },
  { id: "p009", name: "88포장마차 충주건국대점", category: "술집", lat: 36.9490995, lng: 127.9043993, address: "충북 충주시 충열5길 21 1층", hours: "19:00~새벽 02:00", phone: "0507-1339-3854", description: "토요일 정기휴무", source: "학교_주변_매장_정보.xlsx" },
  { id: "p010", name: "풀빵", category: "술집", lat: 36.9492376, lng: 127.904519, address: "충북 충주시 충열5길 19", hours: "17:00~새벽02:00", phone: "", description: "풀빵 주문 21시 마감 \n사장님 사정에 따라 유동적 오픈/마감", source: "학교_주변_매장_정보.xlsx" },
  { id: "p011", name: "레일로드", category: "술집", lat: 36.9495272, lng: 127.9045624, address: "충북 충주시 충열5길 15-2", hours: "18:00~ 새벽03:00", phone: "", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p012", name: "바깥 건국대", category: "술집", lat: 36.9492854, lng: 127.9041032, address: "충북 충주시 충열5길 20 1층", hours: "17:30~ 새벽 6:00", phone: "0507-1430-5227", description: "라스트오더 05시=", source: "학교_주변_매장_정보.xlsx" },
  { id: "p013", name: "치킨마루 충주건대점", category: "밥집", lat: 36.9492854, lng: 127.9041032, address: "충북 충주시 충열5길 20", hours: "15:30~새벽 3:30", phone: "043-843-5020", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p014", name: "돈사랑포차", category: "밥집", lat: 36.9496455, lng: 127.9040705, address: "충북 충주시 단월동 484", hours: "", phone: "010-4484-2047", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p015", name: "마라야 건대점", category: "밥집", lat: 36.9498095, lng: 127.904408, address: "충청북도 충주시 충열5길 13", hours: "11:00~22:30", phone: "", description: "라스트오더 22:00", source: "학교_주변_매장_정보.xlsx" },
  { id: "p016", name: "임소초 본점", category: "밥집", lat: 36.9484146, lng: 127.9041604, address: "충북 충주시 충열4길 21", hours: "11:00~22:00", phone: "", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p017", name: "엄마손분식", category: "밥집", lat: 36.9498095, lng: 127.904408, address: "충북 충주시 충열5길 13", hours: "평일 10:00~19:30\n일요일 10:30~19:30", phone: "043-851-6631", description: "토요일 정기휴무", source: "학교_주변_매장_정보.xlsx" },
  { id: "p018", name: "밀플랜비 충주건국대점", category: "밥집", lat: 36.9499202, lng: 127.9041206, address: "충북 충주시 충열4길 5-7", hours: "10:00~20:00", phone: "0507-1327-9880", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p019", name: "큰집막창 건대점", category: "밥집", lat: 36.9495298, lng: 127.9043945, address: "충북 충주시 충열5길 15-1, 1층", hours: "11:30~24:00", phone: "010-2402-4185", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p020", name: "분식나라", category: "밥집", lat: 36.9501561, lng: 127.9043621, address: "충북 충주시 충열5길 9-1 1층(분식나라)", hours: "09:00~21:30", phone: "043-851-2811", description: "매달 2,4번째 일요일 정기휴무", source: "학교_주변_매장_정보.xlsx" },
  { id: "p021", name: "건대토스트", category: "밥집", lat: 36.9501561, lng: 127.9043621, address: "충북 충주시 충열5길 9-1", hours: "09:30~20:00", phone: "043-856-3060", description: "일요일 정기휴무", source: "학교_주변_매장_정보.xlsx" },
  { id: "p022", name: "컴포즈커피 충주건국대점", category: "카페", lat: 36.9501513, lng: 127.9041023, address: "충청북도 충주시 단월동 486-6", hours: "10:00~21:30", phone: "", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p023", name: "소소, 단월", category: "카페", lat: 36.9500767, lng: 127.9041591, address: "충북 충주시 충열5길 12 1층 소소, 단월", hours: "매일 16:00~ 새벽 1:00", phone: "010-3071-1123", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p024", name: "메가MGC커피 충주건국대점", category: "카페", lat: 36.9487955, lng: 127.9040788, address: "충북 충주시 충열5길 24 1층", hours: "08:00~22:00", phone: "0507-1385-1288", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p025", name: "르비드", category: "카페", lat: 36.9487752, lng: 127.9043656, address: "충북 충주시 충열5길 25", hours: "10:00~20:00", phone: "", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p026", name: "전국팔도", category: "술집", lat: 36.9497942, lng: 127.9034295, address: "충북 충주시 충열4길 5", hours: "18:00~새벽 06:00", phone: "", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p027", name: "카페일노베", category: "카페", lat: 36.9492852, lng: 127.9038846, address: "충북 충주시 충열4길 9-2 1층", hours: "11:00~21:00", phone: "", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p028", name: "건대이모네순대국", category: "밥집", lat: 36.9492852, lng: 127.9038846, address: "충북 충주시 충열4길 9-2", hours: "", phone: "043-851-0537", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p029", name: "아프로 (appro)", category: "술집", lat: 36.9489316, lng: 127.9032174, address: "충북 충주시 충열1길 28", hours: "매일 17:00~ 새벽 2:00", phone: "", description: "라스트오더 0시", source: "학교_주변_매장_정보.xlsx" },
  { id: "p030", name: "쭈꾸대장 충주건대점", category: "밥집", lat: 36.9486355, lng: 127.9034859, address: "충북 충주시 충열1길 20-7 1층", hours: "10:00~22:00", phone: "043-851-7977", description: "토요일 정기휴무", source: "학교_주변_매장_정보.xlsx" },
  { id: "p031", name: "매드슬로우 단월 \n(매슬)", category: "술집", lat: 36.9485058, lng: 127.9038631, address: "충북 충주시 충열4길 18 지하", hours: "18:00~ 새벽03:00", phone: "0507-1367-1039", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p032", name: "게이트원", category: "술집", lat: 36.9478218, lng: 127.9040206, address: "충북 충주시 충열2길 19 1층", hours: "평일 18:00~새벽 04:00\n주말 18:00~새벽 02:00", phone: "0507-1319-3258", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p033", name: "한성대패", category: "밥집", lat: 36.9483787, lng: 127.9033357, address: "충북 충주시 충열1길 20-4", hours: "", phone: "", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p034", name: "82.4 (팔이점사)", category: "술집", lat: 36.9487886, lng: 127.9035407, address: "충북 충주시 충열1길 20-9", hours: "18:00~ 새벽03:00", phone: "010-4861-9711", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p035", name: "슬기로운대학생활 건대점", category: "술집", lat: 36.9499509, lng: 127.9039397, address: "충북 충주시 충열4길 5-5 1층", hours: "18:00~새벽 04:00", phone: "010-3397-3396", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p036", name: "짱돌치킨", category: "밥집", lat: 36.9482512, lng: 127.9026133, address: "충북 충주시 충열1길 17", hours: "17:00~새벽02:00", phone: "043-851-3507", description: "토요일 정기휴무", source: "학교_주변_매장_정보.xlsx" },
  { id: "p037", name: "오뚜기부대찌개", category: "밥집", lat: 36.9479074, lng: 127.9027406, address: "충북 충주시 충열1길 16 1층", hours: "", phone: "043-855-8858", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p038", name: "아트 단월", category: "밥집", lat: 36.9483841, lng: 127.9036274, address: "충북 충주시 충열3길 8 1층", hours: "11:00~21:00", phone: "0507-1436-6177", description: "브레이크타임 15~16시 \n라스트오더 20:20", source: "학교_주변_매장_정보.xlsx" },
  { id: "p039", name: "안성가마솥순대국", category: "밥집", lat: 36.9500767, lng: 127.9041591, address: "충북 충주시 충열5길 12", hours: "09:00~21:30", phone: "", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p040", name: "건국이네밥집", category: "밥집", lat: 36.9487955, lng: 127.9040788, address: "충북 충주시 충열5길 24 104호", hours: "", phone: "", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p041", name: "또올집", category: "술집", lat: 36.9496401, lng: 127.9040966, address: "충북 충주시 충열5길 16 1층", hours: "18:00~ 새벽03:00", phone: "0507-1306-8436", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p042", name: "룸술집 주방", category: "술집", lat: 36.9485786, lng: 127.9027579, address: "충북 충주시 충열1길 21", hours: "18:00~새벽 04:00", phone: "010-9408-3385", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p043", name: "꼬꼬야닭갈비", category: "밥집", lat: 36.9497658, lng: 127.9035679, address: "충북 충주시 충열4길 5-1", hours: "11:00~22:00", phone: "043-853-2800", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p044", name: "한샘식당", category: "밥집", lat: 36.9483787, lng: 127.9033357, address: "충북 충주시 충열1길 20-4", hours: "", phone: "", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p045", name: "여명포차", category: "술집", lat: 36.9497796, lng: 127.9038013, address: "충북 충주시 충열4길 5-3", hours: "18:00~새벽 04:00", phone: "", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p046", name: "동아리왕족발&보쌈", category: "밥집", lat: 36.9449944, lng: 127.9034356, address: "충북 충주시 하단4길 22", hours: "12:00~00:00", phone: "010-6755-3582", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p047", name: "만복정육식당", category: "밥집", lat: 36.9459545, lng: 127.901978, address: "충북 충주시 하단2길 4-1", hours: "", phone: "043-852-8864", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p048", name: "단월반점", category: "밥집", lat: 36.9460508, lng: 127.9010704, address: "충북 충주시 충원대로 194", hours: "10:00~20:00", phone: "", description: "브레이크타임 15:00~16:00", source: "학교_주변_매장_정보.xlsx" },
  { id: "p049", name: "민씨본가", category: "밥집", lat: 36.9465084, lng: 127.9014188, address: "충북 충주시 충원대로 200", hours: "", phone: "043-851-5287", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p050", name: "강릉칼국수", category: "밥집", lat: 36.9464553, lng: 127.9020209, address: "충북 충주시 하단2길 1 102동 1층 102호", hours: "09:00~20:00", phone: "0507-1423-0079", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p051", name: "애프터눈", category: "카페", lat: 36.946946, lng: 127.9019215, address: "충북 충주시 하단1길 24-2 애프터눈 카페", hours: "11:00~20:00", phone: "010-3775-9855", description: "토요일 정기휴무", source: "학교_주변_매장_정보.xlsx" },
  { id: "p052", name: "카페 멜부", category: "카페", lat: 36.9435438, lng: 127.9022995, address: "충북 충주시 하단7길 22-7 1층", hours: "09:30~20:00", phone: "010-8999-2424", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p053", name: "스시마당 건대점", category: "밥집", lat: 36.9518082, lng: 127.9105426, address: "충북 충주시 모시래1길 31", hours: "09:30~22:30", phone: "0507-1325-9387", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p054", name: "마리노피자 건대점", category: "밥집", lat: 36.9520355, lng: 127.9106214, address: "충북 충주시 모시래1길 29-1", hours: "", phone: "043-857-9960", description: "배달전문", source: "학교_주변_매장_정보.xlsx" },
  { id: "p055", name: "함지박 & 카페", category: "카페", lat: 36.9536367, lng: 127.9101005, address: "충북 충주시 모시래2길 7", hours: "11:00~21:30", phone: "043-856-5292", description: "브레이크타임 15:00~17:00", source: "학교_주변_매장_정보.xlsx" },
  { id: "p056", name: "맘스터치 충주건대점", category: "밥집", lat: 36.9487809, lng: 127.9124301, address: "충북 충주시 충원대로 268 해오름학사 1층", hours: "11:00~22:30", phone: "043-857-9800", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p057", name: "워시팡팡셀프빨래방 충주건대점", category: "기타생활", lat: 36.9495664, lng: 127.9031556, address: "충북 충주시 충열4길 6 1층 101호", hours: "24시간", phone: "", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p058", name: "워시팡팡셀프빨래방 충주건대2호점", category: "기타생활", lat: 36.9475307, lng: 127.9022307, address: "충북 충주시 충열1길 7 보스톤타운 E동", hours: "24시간", phone: "", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p059", name: "베스트마트 단월점", category: "기타생활", lat: 36.9461263, lng: 127.9033683, address: "충북 충주시 하단2길 11-7", hours: "", phone: "", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p060", name: "베스트마트 문구", category: "기타생활", lat: 36.9485058, lng: 127.9038631, address: "충북 충주시 충열4길 18", hours: "09:00~새벽 2:00", phone: "", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p061", name: "GS25 충주건대점", category: "편의점", lat: 36.9496401, lng: 127.9040966, address: "충북 충주시 충열5길 16", hours: "", phone: "", description: "택배예약O", source: "학교_주변_매장_정보.xlsx" },
  { id: "p062", name: "CU 건대으뜸점", category: "편의점", lat: 36.9495664, lng: 127.9031556, address: "충북 충주시 충열4길 6 (단월동) 1층", hours: "", phone: "", description: "택배예약O", source: "학교_주변_매장_정보.xlsx" },
  { id: "p063", name: "세븐일레븐 충주건국대카페점", category: "편의점", lat: 36.9487886, lng: 127.9035407, address: "충북 충주시 충열1길 20-9", hours: "", phone: "", description: "택배예약O", source: "학교_주변_매장_정보.xlsx" },
  { id: "p064", name: "GS25 충주단월원룸점", category: "편의점", lat: 36.946581, lng: 127.9019391, address: "충북 충주시 하단1길 18", hours: "", phone: "043-851-0423", description: "택배예약O", source: "학교_주변_매장_정보.xlsx" },
  { id: "p065", name: "이마트24 충주단월건대점", category: "편의점", lat: 36.946981, lng: 127.9016155, address: "충북 충주시 충원대로 206", hours: "", phone: "043-851-9415", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p066", name: "굿아이스크림 할인점", category: "기타생활", lat: 36.9484146, lng: 127.9041604, address: "충북 충주시 충열4길 21 굿편의점", hours: "", phone: "", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p067", name: "충주농협 단월지점", category: "기타생활", lat: 36.9469497, lng: 127.9020825, address: "충북 충주시 하단1길 24-4", hours: "", phone: "043-852-1979", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p068", name: "달천동행정복지센터", category: "기타생활", lat: 36.9477449, lng: 127.9011189, address: "충북 충주시 충원대로 211", hours: "", phone: "043-850-2702", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p069", name: "세븐짐 건대점", category: "기타생활", lat: 36.9487749, lng: 127.9027449, address: "충북 충주시 충원대로 228", hours: "24시간", phone: "0507-1470-7783", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p070", name: "림네일", category: "기타생활", lat: 36.9470156, lng: 127.9036067, address: "충북 충주시 충열4길 42-5 킹스빌 101호", hours: "09:00~22:00", phone: "0507-1324-6827", description: "네일샵", source: "학교_주변_매장_정보.xlsx" },
  { id: "p071", name: "네일신드롬", category: "기타생활", lat: 36.9522403, lng: 127.9097741, address: "충북 충주시 모시래2길 42 1층", hours: "11:00~20:00", phone: "010-8368-7252", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p072", name: "GS25 건대모시래점", category: "편의점", lat: 36.9515005, lng: 127.9105068, address: "충북 충주시 모시래1길 33", hours: "", phone: "", description: "택배예약O", source: "학교_주변_매장_정보.xlsx" },
  { id: "p073", name: "GS25 충주뉴건대원룸점", category: "편의점", lat: 36.9541061, lng: 127.9105903, address: "충북 충주시 모시래길 50", hours: "", phone: "", description: "택배예약O", source: "학교_주변_매장_정보.xlsx" },
  { id: "p074", name: "포토이즘 박스 충주 건국대점", category: "기타오락", lat: 36.9484146, lng: 127.9041604, address: "충북 충주시 충열4길 21", hours: "24시간", phone: "", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p075", name: "팝콘피씨1호점", category: "기타오락", lat: 36.949372, lng: 127.9034626, address: "충북 충주시 충열1길 34", hours: "24시간", phone: "", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p076", name: "팝콘피씨2호점", category: "기타오락", lat: 36.9492852, lng: 127.9038846, address: "충북 충주시 충열4길 9-2", hours: "24시간", phone: "", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p077", name: "팝콘코인노래방", category: "기타오락", lat: 36.9490728, lng: 127.9041112, address: "충북 충주시 충열5길 22 지하1층", hours: "24시간", phone: "", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p078", name: "마이꼴밴드 노래연습장", category: "기타오락", lat: 36.94982, lng: 127.9032612, address: "충북 충주시 충열4길 3", hours: "", phone: "", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p079", name: "늘PC", category: "기타오락", lat: 36.9500767, lng: 127.9041591, address: "충북 충주시 충열5길 12 2층 늘PC방", hours: "24시간", phone: "", description: "", source: "학교_주변_매장_정보.xlsx" },
  { id: "p080", name: "신촌당구타운", category: "기타오락", lat: 36.9495232, lng: 127.9041069, address: "충북 충주시 충열5길 16-1", hours: "~새벽 1:00", phone: "", description: "사장님 컨디션에 따라 유동적 운영", source: "학교_주변_매장_정보.xlsx" },
];
