import * as XLSX from 'xlsx'

// 자동 글쓰기 샘플 데이터 (비회원)
export const generateAutoPostSampleNonMember = () => {
  const sampleData = [
    {
      갤러리주소: 'https://m.dcinside.com/board/football_new9',
      제목: '안녕',
      닉네임: '닉네임1',
      내용HTML: '<p>첫번째</p><p>HTML 태그를 사용할 수 있습니다.</p>',
      비밀번호: '1234',
      이미지경로1: '',
      이미지경로2: '',
      이미지경로3: '',
      이미지경로4: '',
      이미지경로5: '',
      이미지경로6: '',
      이미지경로7: '',
      이미지경로8: '',
      이미지경로9: '',
      이미지경로10: '',
      이미지위치: '',
      말머리: '',
      로그인ID: '',
      로그인비번: '',
      예약날짜: '',
      '등록후자동삭제(분)': '10',
      댓글: '',
    },
    {
      갤러리주소: 'https://m.dcinside.com/board/maplestory_new',
      제목: '두 번째 샘플 게시글',
      닉네임: '닉네임2',
      내용HTML: '<p>2번째</p>',
      비밀번호: '5678',
      이미지경로1: '',
      이미지경로2: '',
      이미지경로3: '',
      이미지경로4: '',
      이미지경로5: '',
      이미지경로6: '',
      이미지경로7: '',
      이미지경로8: '',
      이미지경로9: '',
      이미지경로10: '',
      이미지위치: '',
      말머리: '',
      로그인ID: '',
      로그인비번: '',
      예약날짜: '',
      '등록후자동삭제(분)': '10',
      댓글: '',
    },
  ]

  return createExcelFile(sampleData, '자동글쓰기_비회원_샘플')
}

// 자동 글쓰기 샘플 데이터 (회원)
export const generateAutoPostSampleMember = () => {
  const sampleData = [
    {
      갤러리주소: 'https://m.dcinside.com/board/mistertrot',
      제목: '회원 샘플 게시글 제목입니다',
      닉네임: '',
      내용HTML:
        '<p>회원으로 작성하는 샘플 게시글 내용입니다.</p><p>로그인 정보가 있으면 닉네임과 비밀번호는 비워두세요.</p>',
      비밀번호: '',
      이미지경로1: '',
      이미지경로2: '',
      이미지경로3: '',
      이미지경로4: '',
      이미지경로5: '',
      이미지경로6: '',
      이미지경로7: '',
      이미지경로8: '',
      이미지경로9: '',
      이미지경로10: '',
      이미지위치: '',
      말머리: '',
      로그인ID: '로그인 아이디',
      로그인비번: '로그인 비밀번호',
      예약날짜: '',
      '등록후자동삭제(분)': '10',
      댓글: '',
    },
    {
      갤러리주소: 'https://m.dcinside.com/board/football_new9',
      제목: '회원 두 번째 샘플 게시글',
      닉네임: '',
      내용HTML: '<p>회원으로 작성하는 두 번째 샘플 내용입니다.</p>',
      비밀번호: '',
      이미지경로1: '',
      이미지경로2: '',
      이미지경로3: '',
      이미지경로4: '',
      이미지경로5: '',
      이미지경로6: '',
      이미지경로7: '',
      이미지경로8: '',
      이미지경로9: '',
      이미지경로10: '',
      이미지위치: '',
      말머리: '',
      로그인ID: '로그인 아이디',
      로그인비번: '로그인 비밀번호',
      예약날짜: '',
      '등록후자동삭제(분)': '10',
      댓글: '',
    },
  ]

  return createExcelFile(sampleData, '자동글쓰기_회원_샘플')
}

// 자동 댓글 샘플 데이터 (비회원 - 갤러리 닉네임)
export const generateAutoCommentSampleNonMemberGallery = () => {
  const sampleData = [
    {
      'DC URL': 'https://m.dcinside.com/board/mistertrot/1234',
      댓글내용: '갤러리 닉네임을 사용하는 댓글입니다.',
      닉네임: '',
      비밀번호: '',
      로그인ID: '',
      로그인비밀번호: '',
      예약날짜: '',
      쿠파스: '0',
      워드프레스URL: '',
      워드프레스사용자명: '',
      워드프레스API키: '',
    },
    {
      'DC URL': 'https://m.dcinside.com/board/maplestory_new/1234',
      댓글내용: '두 번째 갤러리 닉네임 댓글입니다.',
      닉네임: '',
      비밀번호: '',
      로그인ID: '',
      로그인비밀번호: '',
      예약날짜: '',
      쿠파스: '0',
      워드프레스URL: '',
      워드프레스사용자명: '',
      워드프레스API키: '',
    },
  ]

  return createExcelFile(sampleData, '자동댓글_비회원_갤러리닉_샘플')
}

// 자동 댓글 샘플 데이터 (비회원 - 닉네임 입력)
export const generateAutoCommentSampleNonMemberNickname = () => {
  const sampleData = [
    {
      'DC URL': 'https://m.dcinside.com/board/mistertrot/1234',
      댓글내용: '닉네임을 직접 입력하는 댓글입니다.',
      닉네임: '테스트닉네임1',
      비밀번호: '1234',
      로그인ID: '',
      로그인비밀번호: '',
      예약날짜: '',
      쿠파스: '0',
      워드프레스URL: '',
      워드프레스사용자명: '',
      워드프레스API키: '',
    },
    {
      'DC URL': 'https://m.dcinside.com/board/maplestory_new/1234',
      댓글내용: '두 번째 닉네임 입력 댓글입니다.',
      닉네임: '테스트닉네임2',
      비밀번호: '5678',
      로그인ID: '',
      로그인비밀번호: '',
      예약날짜: '',
      쿠파스: '0',
      워드프레스URL: '',
      워드프레스사용자명: '',
      워드프레스API키: '',
    },
  ]

  return createExcelFile(sampleData, '자동댓글_비회원_닉네임입력_샘플')
}

// 자동 댓글 샘플 데이터 (회원)
export const generateAutoCommentSampleMember = () => {
  const sampleData = [
    {
      'DC URL': 'https://m.dcinside.com/board/mistertrot/1234',
      댓글내용: '회원으로 작성하는 댓글입니다.',
      닉네임: '',
      비밀번호: '',
      로그인ID: '로그인 아이디',
      로그인비밀번호: '로그인 비밀번호',
      예약날짜: '',
      쿠파스: '0',
      워드프레스URL: '',
      워드프레스사용자명: '',
      워드프레스API키: '',
    },
    {
      'DC URL': 'https://m.dcinside.com/board/maplestory_new/1234',
      댓글내용: '회원으로 작성하는 두 번째 댓글입니다.',
      닉네임: '',
      비밀번호: '',
      로그인ID: '로그인 아이디',
      로그인비밀번호: '로그인 비밀번호',
      예약날짜: '',
      쿠파스: '0',
      워드프레스URL: '',
      워드프레스사용자명: '',
      워드프레스API키: '',
    },
  ]

  return createExcelFile(sampleData, '자동댓글_회원_샘플')
}

// 쿠파스 워크플로우 샘플 데이터
export const generateAutoCommentSampleCoupas = () => {
  const sampleData = [
    {
      'DC URL': 'https://gall.dcinside.com/board/view/?id=football_new9&no=12345',
      댓글내용: '쿠파스 워크플로우: DC 게시글 → 쿠팡 검색 → 워드프레스 포스팅 → 댓글 작성',
      닉네임: '테스트닉네임',
      비밀번호: '1234',
      로그인ID: '',
      로그인비밀번호: '',
      예약날짜: '',
      쿠파스: '1',
      워드프레스URL: 'https://your-wordpress-site.com',
      워드프레스사용자명: 'admin',
      워드프레스API키: 'your-wordpress-api-key',
    },
    {
      'DC URL': 'https://gall.dcinside.com/board/view/?id=maplestory_new&no=12346',
      댓글내용: '두 번째 쿠파스 작업입니다.',
      닉네임: '',
      비밀번호: '',
      로그인ID: '로그인 아이디',
      로그인비밀번호: '로그인 비밀번호',
      예약날짜: '',
      쿠파스: '1',
      워드프레스URL: 'https://your-wordpress-site.com',
      워드프레스사용자명: 'admin',
      워드프레스API키: 'your-wordpress-api-key',
    },
  ]

  return createExcelFile(sampleData, '자동댓글_쿠파스_샘플')
}

// 엑셀 파일 생성 및 다운로드
function createExcelFile(data: any[], fileName: string) {
  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, '샘플 데이터')

  // 파일명에 타임스탬프 추가
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  const fullFileName = `${fileName}_${timestamp}.xlsx`

  // 파일 다운로드
  XLSX.writeFile(workbook, fullFileName)

  return fullFileName
}
