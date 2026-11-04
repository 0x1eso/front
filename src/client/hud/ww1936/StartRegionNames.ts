// World War 1936 lobby: the names of the regions the start armies stand in
// (START_OOB), so the lobby can say "Eritrea" without loading scenario.json
// (1 MB). Pinned against the shipped scenario by a test.
const NAMES: Readonly<Record<number, readonly [string, string]>> = {
  163: ["Leningrad", "레닌그라드"],
  193: ["Novgorod", "노브고로드"],
  247: ["Vitebsk", "비쳅스크"],
  251: ["Khabarovsk (S)", "하바롭스크 지방 남부"],
  271: ["Pomerania", "포메른"],
  277: ["City of Minsk", "민스크"],
  306: ["Berlin", "베를린"],
  322: ["Nordrhein-Westfalen", "노르트라인베스트팔렌"],
  329: ["London", "런던"],
  335: ["Lower Silesia", "니더슐레지엔"],
  337: ["Hampshire", "햄프셔"],
  341: ["Zhytomyr", "지토미르"],
  344: ["Kiev City", "키예프"],
  352: ["Upper Silesia", "오버슐레지엔"],
  353: ["Pas-de-Calais", "파드칼레"],
  356: ["Rheinland-Pfalz", "라인란트팔츠"],
  364: ["Khmel'nyts'kyy", "흐멜니츠키"],
  376: ["Meuse", "뫼즈"],
  379: ["Marne", "마른"],
  390: ["Moselle", "모젤"],
  424: ["Primor'ye", "프리모르스키 지방"],
  429: ["Odessa", "오데사"],
  482: ["Milano", "밀라노현"],
  486: ["Jilin", "지린성"],
  494: ["Turin", "토리노현"],
  497: ["Savoie", "사부아"],
  531: ["Alpes-Maritimes", "알프마리팀"],
  553: ["Liaoning", "랴오닝성"],
  570: ["Tashkent", "타슈켄트"],
  576: ["Roma", "로마도"],
  601: ["Tbilisi", "트빌리시"],
  603: ["Bakı", "바쿠"],
  609: ["Napoli", "나폴리도"],
  662: ["District of Columbia", "워싱턴 D.C."],
  666: ["Kwantung", "관동주"],
  669: ["Stalinabad", "스탈리나바드"],
  679: ["Seoul", "서울"],
  686: ["P'yŏngyang", "평양직할시"],
  725: ["Tunis", "튀니스"],
  729: ["Aleppo", "알레포"],
  733: ["Alger", "알제"],
  749: ["Texas", "텍사스"],
  758: ["Tokyo", "도쿄도"],
  766: ["Ōsaka", "오사카부"],
  767: ["Cairo", "카이로"],
  787: ["Grand Casablanca", "대카사블랑카 지방"],
  809: ["Tripolitania", "트리폴리타니아"],
  812: ["Ajdabiya", "아즈다비야 지구"],
  901: ["Taiwan", "대만"],
  918: ["Ha Noi", "하노이"],
  927: ["Hong Kong", "홍콩"],
  930: ["Hawaii", "하와이"],
  933: ["Khartoum", "하르툼"],
  945: ["Philippines", "필리핀"],
  980: ["Eritrea", "에리트레아"],
  988: ["Saigon", "사이공"],
  1039: ["Italian Somaliland", "이탈리아령 소말릴란드"],
  1087: ["Malaya", "말라야"],
  1104: ["Nairobi", "나이로비"],
};

/** The name of a START_OOB region in the UI's language; "" when unknown. */
export function startRegionName(id: number, korean: boolean): string {
  const n = NAMES[id];
  return n === undefined ? "" : n[korean ? 1 : 0];
}

export const START_REGION_IDS: readonly number[] =
  Object.keys(NAMES).map(Number);
