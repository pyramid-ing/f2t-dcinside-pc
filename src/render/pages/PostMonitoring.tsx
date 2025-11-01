import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Switch,
  message,
  Upload,
  Popconfirm,
  Tag,
  Statistic,
  Row,
  Col,
  Tabs,
  Typography,
  Tooltip,
  List,
  Radio,
  Select,
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  StopOutlined,
  UploadOutlined,
  MessageOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SettingOutlined,
  DownloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import * as monitoringApi from '@render/api/monitoringApi'
import type {
  MonitoredGallery,
  MonitoredPost,
  CreateMonitoredGalleryDto,
  AiPromptOption,
  ApprovedStatus,
  BlacklistedGallery,
} from '@render/api/monitoringApi'
import * as XLSX from 'xlsx'
import { useSettings } from '@render/hooks/useSettings'
import { getSettings } from '@render/api/settingsApi'

const { TextArea } = Input
const { Title, Text } = Typography

const PostMonitoring: React.FC = () => {
  // 상태 관리
  const [galleries, setGalleries] = useState<MonitoredGallery[]>([])
  const [posts, setPosts] = useState<MonitoredPost[]>([])
  const [loading, setLoading] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingGallery, setEditingGallery] = useState<MonitoredGallery | null>(null)
  const [form] = Form.useForm()
  const [status, setStatus] = useState<monitoringApi.MonitoringStatus | null>(null)
  const [selectedGalleryId, setSelectedGalleryId] = useState<string | undefined>(undefined)
  const [activeTab, setActiveTab] = useState('galleries')
  const [settingsModalVisible, setSettingsModalVisible] = useState(false)
  const [settingsForm] = Form.useForm()
  const { settings, updateSettings } = useSettings()
  const [newComment, setNewComment] = useState('')
  const comments: string[] = Form.useWatch('comments', settingsForm) || []
  const [editingCommentIndex, setEditingCommentIndex] = useState<number | null>(null)
  const [editingCommentValue, setEditingCommentValue] = useState('')
  const [aiPrompts, setAiPrompts] = useState<AiPromptOption[]>([])

  // 접두어/접미사 템플릿 상태
  const [newPrefix, setNewPrefix] = useState('')
  const [newSuffix, setNewSuffix] = useState('')
  const prefixes: string[] = Form.useWatch('commentPrefixes', settingsForm) || []
  const suffixes: string[] = Form.useWatch('commentSuffixes', settingsForm) || []

  // 블랙리스트 상태
  const [blacklist, setBlacklist] = useState<BlacklistedGallery[]>([])
  const [blacklistModalVisible, setBlacklistModalVisible] = useState(false)
  const [editingBlacklist, setEditingBlacklist] = useState<BlacklistedGallery | null>(null)
  const [blacklistForm] = Form.useForm()
  const [selectedBlacklistIds, setSelectedBlacklistIds] = useState<string[]>([])
  const [blacklistSearchText, setBlacklistSearchText] = useState('')

  // 쿠파스 수동 실행 상태
  const [coupasModalVisible, setCoupasModalVisible] = useState(false)
  const [coupasForm] = Form.useForm()
  const [coupasLoading, setCoupasLoading] = useState(false)
  const [wordpressAccounts, setWordpressAccounts] = useState<any[]>([])

  // 갤러리 검색/필터 상태
  const [gallerySearchText, setGallerySearchText] = useState('')
  const [galleryStatusFilter, setGalleryStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [selectedGalleryIds, setSelectedGalleryIds] = useState<string[]>([])

  // 게시글 검색/필터 상태
  const [postSearchText, setPostSearchText] = useState('')
  const [postStatusFilter, setPostStatusFilter] = useState<'all' | 'answered' | 'unanswered'>('all')
  const [postGalleryFilter, setPostGalleryFilter] = useState<string | undefined>(undefined)
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([])

  // 데이터 로드
  useEffect(() => {
    loadData()
    loadStatus()
    loadAiPrompts()
    loadBlacklist()
    const interval = setInterval(loadStatus, 10000) // 10초마다 상태 갱신
    return () => clearInterval(interval)
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [galleriesData, postsData] = await Promise.all([
        monitoringApi.getAllGalleries(),
        monitoringApi.getPosts(selectedGalleryId ? { galleryId: selectedGalleryId } : {}),
      ])
      setGalleries(galleriesData)
      setPosts(postsData)
    } catch (error) {
      message.error('데이터 로드 실패')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const loadStatus = async () => {
    try {
      const statusData = await monitoringApi.getMonitoringStatus()
      setStatus(statusData)
    } catch (error) {
      console.error('상태 로드 실패:', error)
    }
  }

  const loadAiPrompts = async () => {
    try {
      const prompts = await monitoringApi.getAiPrompts()
      setAiPrompts(prompts)
    } catch (error) {
      console.error('AI 프롬프트 로드 실패:', error)
    }
  }

  const loadBlacklist = async () => {
    try {
      const data = await monitoringApi.getAllBlacklistedGalleries()
      setBlacklist(data)
    } catch (error) {
      console.error('블랙리스트 로드 실패:', error)
    }
  }

  // 갤러리 추가/수정 모달
  const showModal = (gallery?: MonitoredGallery) => {
    if (gallery) {
      setEditingGallery(gallery)
      form.setFieldsValue(gallery)
    } else {
      setEditingGallery(null)
      form.resetFields()
    }
    setModalVisible(true)
  }

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields()
      if (editingGallery) {
        await monitoringApi.updateGallery(editingGallery.id, values)
        message.success('모니터링이 수정되었습니다.')
      } else {
        await monitoringApi.createGallery(values)
        message.success('모니터링이 추가되었습니다.')
      }
      setModalVisible(false)
      loadData()
    } catch (error) {
      message.error('저장 실패')
      console.error(error)
    }
  }

  // 갤러리 삭제
  const handleDeleteGallery = async (id: string) => {
    try {
      await monitoringApi.deleteGallery(id)
      message.success('갤러리가 삭제되었습니다.')
      loadData()
    } catch (error) {
      message.error('삭제 실패')
      console.error(error)
    }
  }

  // 갤러리 활성화/비활성화
  const handleToggleActive = async (id: string) => {
    try {
      await monitoringApi.toggleGalleryActive(id)
      message.success('갤러리 상태가 변경되었습니다.')
      loadData()
    } catch (error) {
      message.error('상태 변경 실패')
      console.error(error)
    }
  }

  // 크롤링 시작/중지
  const handleToggleCrawling = async () => {
    try {
      if (status?.crawler.isRunning) {
        await monitoringApi.stopCrawling()
        message.success('크롤링을 중지했습니다.')
      } else {
        await monitoringApi.startCrawling()
        message.success('크롤링을 시작했습니다.')
      }
      loadStatus()
    } catch (error) {
      message.error('크롤링 상태 변경 실패')
      console.error(error)
    }
  }

  // 엑셀 샘플 다운로드
  const handleExcelSampleDownload = () => {
    try {
      // 샘플 데이터 생성
      const sampleData = [
        {
          갤러리URL: 'https://gall.dcinside.com/mini/board/lists/?id=dophinbap',
          갤러리ID: '(자동 파싱)',
          갤러리명: '(자동 크롤링)',
          댓글내용: '좋은 정보 감사합니다!',
          로그인ID: 'your_login_id',
          로그인비밀번호: 'your_password',
          닉네임: '닉네임',
          비밀번호: '1234',
          비고: '테스트용 갤러리',
        },
        {
          갤러리URL: 'https://gall.dcinside.com/mini/board/lists/?id=programming',
          갤러리ID: '(자동 파싱)',
          갤러리명: '(자동 크롤링)',
          댓글내용: '',
          로그인ID: '',
          로그인비밀번호: '',
          닉네임: '개발자',
          비밀번호: '5678',
          비고: '프로그래밍 관련 정보',
        },
      ]

      // 워크북 생성
      const workbook = XLSX.utils.book_new()
      const worksheet = XLSX.utils.json_to_sheet(sampleData)

      // 컬럼 너비 설정
      const columnWidths = [
        { wch: 50 }, // 갤러리URL
        { wch: 20 }, // 갤러리ID
        { wch: 15 }, // 갤러리명
        { wch: 25 }, // 댓글내용
        { wch: 15 }, // 로그인ID
        { wch: 15 }, // 로그인비밀번호
        { wch: 10 }, // 닉네임
        { wch: 10 }, // 비밀번호
        { wch: 30 }, // 비고
      ]
      worksheet['!cols'] = columnWidths

      // 워크북에 워크시트 추가
      XLSX.utils.book_append_sheet(workbook, worksheet, '갤러리목록')

      // 파일 다운로드
      const fileName = `갤러리_모니터링_샘플_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(workbook, fileName)

      message.success('엑셀 샘플 파일이 다운로드되었습니다.')
    } catch (error) {
      message.error('엑셀 샘플 다운로드 실패')
      console.error(error)
    }
  }

  // 갤러리 목록 엑셀 다운로드 (API 호출)
  const handleGalleryListDownload = async () => {
    try {
      await monitoringApi.downloadGalleriesExcel()
      message.success('갤러리 목록이 엑셀 파일로 다운로드되었습니다.')
    } catch (error) {
      message.error('갤러리 목록 다운로드 실패')
      console.error(error)
    }
  }

  // 엑셀 업로드
  const handleExcelUpload = async (file: File) => {
    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data)
      const worksheet = workbook.Sheets[workbook.SheetNames[0]]
      const jsonData = XLSX.utils.sheet_to_json(worksheet)

      const galleries: CreateMonitoredGalleryDto[] = jsonData.map((row: any) => {
        // 갤러리ID와 갤러리명이 자동 파싱/크롤링 표시일 경우 제외
        const galleryId = row['갤러리ID'] || row['galleryId']
        const galleryName = row['갤러리명'] || row['galleryName']
        const galleryUrl = row['갤러리URL'] || row['galleryUrl']

        // 타입 변환
        const type = row['타입'] === '검색' ? 'search' : 'gallery'
        let actionType = undefined
        if (row['작업타입'] === '쿠파스') actionType = 'coupas'
        else if (row['작업타입'] === '고정댓글') actionType = 'fixed_comment'

        // 활성상태 변환
        const isActive = row['활성상태'] === '활성' ? true : false

        return {
          type,
          actionType,
          galleryUrl,
          galleryId: galleryId && !galleryId.includes('자동') ? galleryId : undefined,
          galleryName: galleryName && !galleryName.includes('자동') ? galleryName : undefined,
          searchKeyword: row['검색키워드'] || row['searchKeyword'],
          commentText: row['댓글내용'] || row['commentText'],
          loginId: row['로그인ID'] || row['loginId'],
          loginPassword: row['로그인비밀번호'] || row['loginPassword'],
          nickname: row['닉네임'] || row['nickname'],
          password: row['비밀번호'] || row['password'],
          isActive,
        }
      })

      await monitoringApi.createBulkGalleries({ galleries })
      message.success(`${galleries.length}개의 갤러리를 추가했습니다.`)
      loadData()
    } catch (error) {
      message.error('엑셀 업로드 실패')
      console.error(error)
    }
    return false // 자동 업로드 방지
  }

  // 자동 댓글 시작/중지
  const handleToggleAutoComment = async () => {
    try {
      if (status?.autoComment.isRunning) {
        await monitoringApi.stopAutoComment()
        message.success('자동 댓글을 중지했습니다.')
      } else {
        const comments = settings?.comments || []
        await monitoringApi.startAutoComment(comments)
        message.success('자동 댓글을 시작했습니다.')
      }
      loadStatus()
    } catch (error) {
      message.error('자동 댓글 상태 변경 실패')
      console.error(error)
    }
  }

  // 설정 모달 열기
  const showSettingsModal = () => {
    settingsForm.setFieldsValue({
      comments: settings?.comments || [],
      commentSelectionMethod: settings?.commentSelectionMethod || 'random',
      commentPrefixes: settings?.commentPrefixes || [],
      commentSuffixes: settings?.commentSuffixes || [],
    })
    setSettingsModalVisible(true)
  }

  // 설정 저장
  const handleSettingsSave = async () => {
    try {
      const values = await settingsForm.validateFields()
      await updateSettings({
        ...settings,
        comments: values.comments || [],
        commentSelectionMethod: values.commentSelectionMethod || 'random',
        commentPrefixes: values.commentPrefixes || [],
        commentSuffixes: values.commentSuffixes || [],
      })
      message.success('설정이 저장되었습니다.')
      setSettingsModalVisible(false)
    } catch (error) {
      message.error('설정 저장 실패')
      console.error(error)
    }
  }

  // 댓글 추가
  const handleAddComment = () => {
    if (!newComment.trim()) {
      message.warning('댓글 내용을 입력해주세요.')
      return
    }

    const currentComments = settingsForm.getFieldValue('comments') || []
    settingsForm.setFieldValue('comments', [...currentComments, newComment.trim()])
    setNewComment('')
  }

  // 댓글 삭제
  const handleRemoveComment = (index: number) => {
    const currentComments = settingsForm.getFieldValue('comments') || []
    settingsForm.setFieldValue(
      'comments',
      currentComments.filter((_, i) => i !== index),
    )
  }

  // 댓글 수정 시작
  const handleStartEditComment = (index: number) => {
    const currentComments = settingsForm.getFieldValue('comments') || []
    setEditingCommentIndex(index)
    setEditingCommentValue(currentComments[index] || '')
  }

  // 댓글 수정 저장
  const handleSaveEditComment = () => {
    if (editingCommentIndex === null) return
    const value = editingCommentValue.trim()
    if (!value) {
      message.warning('댓글 내용을 입력해주세요.')
      return
    }
    const currentComments = settingsForm.getFieldValue('comments') || []
    const next = [...currentComments]
    next[editingCommentIndex] = value
    settingsForm.setFieldValue('comments', next)
    setEditingCommentIndex(null)
    setEditingCommentValue('')
  }

  const handleCancelEditComment = () => {
    setEditingCommentIndex(null)
    setEditingCommentValue('')
  }

  // 접두어 추가
  const handleAddPrefix = () => {
    if (!newPrefix.trim()) {
      message.warning('접두어를 입력해주세요.')
      return
    }
    const currentPrefixes = settingsForm.getFieldValue('commentPrefixes') || []
    settingsForm.setFieldValue('commentPrefixes', [...currentPrefixes, newPrefix.trim()])
    setNewPrefix('')
  }

  // 접두어 삭제
  const handleRemovePrefix = (index: number) => {
    const currentPrefixes = settingsForm.getFieldValue('commentPrefixes') || []
    settingsForm.setFieldValue(
      'commentPrefixes',
      currentPrefixes.filter((_, i) => i !== index),
    )
  }

  // 접미사 추가
  const handleAddSuffix = () => {
    if (!newSuffix.trim()) {
      message.warning('접미사를 입력해주세요.')
      return
    }
    const currentSuffixes = settingsForm.getFieldValue('commentSuffixes') || []
    settingsForm.setFieldValue('commentSuffixes', [...currentSuffixes, newSuffix.trim()])
    setNewSuffix('')
  }

  // 접미사 삭제
  const handleRemoveSuffix = (index: number) => {
    const currentSuffixes = settingsForm.getFieldValue('commentSuffixes') || []
    settingsForm.setFieldValue(
      'commentSuffixes',
      currentSuffixes.filter((_, i) => i !== index),
    )
  }

  // 수동으로 댓글 달기
  const handleAnswerPost = async (postId: string) => {
    try {
      await monitoringApi.answerPost({ postId })
      message.success('댓글을 달았습니다.')
      loadData()
    } catch (error) {
      message.error('댓글 달기 실패')
      console.error(error)
    }
  }

  // AI 검증 재시도
  const handleRetryAiCheck = async (postId: string) => {
    try {
      await monitoringApi.retryAiCheck(postId)
      message.success('AI 검증을 재시도했습니다.')
      loadData()
    } catch (error) {
      message.error('AI 검증 재시도 실패')
      console.error(error)
    }
  }

  // AI 상태에 따른 태그 색상 및 텍스트
  const getAiStatusTag = (status: ApprovedStatus, reason: string | null) => {
    const statusConfig = {
      PENDING: { color: 'default', text: '검사대기', icon: <ClockCircleOutlined /> },
      APPROVED: { color: 'success', text: 'AI승인', icon: <CheckCircleOutlined /> },
      REJECTED: { color: 'error', text: 'AI거부', icon: null },
      FAILED: { color: 'warning', text: 'AI실패', icon: null },
    }

    const config = statusConfig[status] || statusConfig.PENDING

    return (
      <Tooltip title={reason || 'AI 판단 이유 없음'}>
        <Tag color={config.color} icon={config.icon} style={{ fontSize: 11 }}>
          {config.text}
        </Tag>
      </Tooltip>
    )
  }

  // 갤러리 일괄 삭제
  const handleBulkDeleteGalleries = async () => {
    if (selectedGalleryIds.length === 0) {
      message.warning('삭제할 갤러리를 선택해주세요.')
      return
    }

    try {
      await Promise.all(selectedGalleryIds.map(id => monitoringApi.deleteGallery(id)))
      message.success(`${selectedGalleryIds.length}개의 갤러리가 삭제되었습니다.`)
      setSelectedGalleryIds([])
      loadData()
    } catch (error) {
      message.error('일괄 삭제 실패')
      console.error(error)
    }
  }

  // 갤러리 일괄 활성화
  const handleBulkActivateGalleries = async () => {
    if (selectedGalleryIds.length === 0) {
      message.warning('활성화할 갤러리를 선택해주세요.')
      return
    }

    try {
      const result = await monitoringApi.bulkUpdateGalleryStatus({
        ids: selectedGalleryIds,
        isActive: true,
      })
      message.success(`${result.updatedCount}개의 갤러리가 활성화되었습니다.`)
      setSelectedGalleryIds([])
      loadData()
    } catch (error) {
      message.error('일괄 활성화 실패')
      console.error(error)
    }
  }

  // 갤러리 일괄 비활성화
  const handleBulkDeactivateGalleries = async () => {
    if (selectedGalleryIds.length === 0) {
      message.warning('비활성화할 갤러리를 선택해주세요.')
      return
    }

    try {
      const result = await monitoringApi.bulkUpdateGalleryStatus({
        ids: selectedGalleryIds,
        isActive: false,
      })
      message.success(`${result.updatedCount}개의 갤러리가 비활성화되었습니다.`)
      setSelectedGalleryIds([])
      loadData()
    } catch (error) {
      message.error('일괄 비활성화 실패')
      console.error(error)
    }
  }

  // 단일 갤러리 크롤링
  const handleCrawlGallery = async (galleryId: string) => {
    try {
      const result = await monitoringApi.crawlGalleries([galleryId])
      if (result.successCount > 0) {
        const newPostCount = result.results[0]?.newPostCount || 0
        message.success(`크롤링 완료: 새 게시글 ${newPostCount}개 발견`)
      } else if (result.results[0]?.error) {
        message.error(`크롤링 실패: ${result.results[0].error}`)
      }
      loadData()
    } catch (error) {
      message.error('갤러리 크롤링 실패')
      console.error(error)
    }
  }

  // 갤러리 일괄 크롤링
  const handleBulkCrawlGalleries = async () => {
    if (selectedGalleryIds.length === 0) {
      message.warning('크롤링할 갤러리를 선택해주세요.')
      return
    }

    try {
      const result = await monitoringApi.crawlGalleries(selectedGalleryIds)
      const totalNewPosts = result.results.reduce((sum, r) => sum + (r.newPostCount || 0), 0)
      message.success(
        `크롤링 완료: 성공 ${result.successCount}개, 실패 ${result.failedCount}개, 새 게시글 ${totalNewPosts}개`,
      )
      setSelectedGalleryIds([])
      loadData()
    } catch (error) {
      message.error('일괄 크롤링 실패')
      console.error(error)
    }
  }

  // 갤러리 전체 선택
  const handleSelectAllGalleries = () => {
    setSelectedGalleryIds(filteredGalleries.map(g => g.id))
  }

  // 갤러리 전체 해제
  const handleDeselectAllGalleries = () => {
    setSelectedGalleryIds([])
  }

  // 게시글 일괄 삭제
  const handleBulkDeletePosts = async () => {
    if (selectedPostIds.length === 0) {
      message.warning('삭제할 게시글을 선택해주세요.')
      return
    }

    try {
      const result = await monitoringApi.bulkDeletePosts(selectedPostIds)
      message.success(`${result.deletedCount}개의 게시글이 삭제되었습니다.`)
      setSelectedPostIds([])
      loadData()
    } catch (error) {
      message.error('일괄 삭제 실패')
      console.error(error)
    }
  }

  // 선택한 게시글에 일괄 댓글 달기
  const handleBulkAnswerPosts = async () => {
    if (selectedPostIds.length === 0) {
      message.warning('댓글을 달 게시글을 선택해주세요.')
      return
    }

    try {
      // 미답변 게시글만 필터링
      const unansweredPostIds = selectedPostIds.filter(id => {
        const post = posts.find(p => p.id === id)
        return post && !post.answered
      })

      if (unansweredPostIds.length === 0) {
        message.warning('선택한 게시글 중 미답변 게시글이 없습니다.')
        return
      }

      // 새로운 벌크 답변달기 API 사용
      const result = await monitoringApi.bulkAnswerPosts({
        postIds: unansweredPostIds,
      })

      message.success(
        `${result.answeredCount}개의 게시글에 댓글을 달았습니다.${result.failedCount > 0 ? ` (${result.failedCount}개 실패)` : ''}`,
      )
      setSelectedPostIds([])
      loadData()
    } catch (error) {
      message.error('일괄 댓글 달기 실패')
      console.error(error)
    }
  }

  // 게시글 전체 선택 (미답변 게시글만)
  const handleSelectAllPosts = () => {
    setSelectedPostIds(filteredUnansweredPosts.map(p => p.id))
  }

  // 게시글 전체 해제
  const handleDeselectAllPosts = () => {
    setSelectedPostIds([])
  }

  // 필터링된 갤러리 데이터
  const filteredGalleries = galleries.filter(gallery => {
    // 상태 필터
    if (galleryStatusFilter === 'active' && !gallery.isActive) return false
    if (galleryStatusFilter === 'inactive' && gallery.isActive) return false

    // 검색 필터
    if (gallerySearchText) {
      const searchLower = gallerySearchText.toLowerCase()
      const matchName = gallery.galleryName?.toLowerCase().includes(searchLower)
      const matchId = gallery.galleryId?.toLowerCase().includes(searchLower)
      const matchUrl = gallery.galleryUrl?.toLowerCase().includes(searchLower)
      const matchComment = gallery.commentText?.toLowerCase().includes(searchLower)

      if (!matchName && !matchId && !matchUrl && !matchComment) return false
    }

    return true
  })

  // 필터링된 게시글 데이터
  const filteredPosts = posts.filter(post => {
    // 답변 상태 필터
    if (postStatusFilter === 'answered' && !post.answered) return false
    if (postStatusFilter === 'unanswered' && post.answered) return false

    // 갤러리 필터
    if (postGalleryFilter && post.galleryId !== postGalleryFilter) return false

    // 검색 필터
    if (postSearchText) {
      const searchLower = postSearchText.toLowerCase()
      const matchTitle = post.postTitle?.toLowerCase().includes(searchLower)
      const matchAuthor = post.authorName?.toLowerCase().includes(searchLower)
      const matchGallery = post.gallery?.galleryName?.toLowerCase().includes(searchLower)

      if (!matchTitle && !matchAuthor && !matchGallery) return false
    }

    return true
  })

  // 필터링된 미답변 게시글들
  const filteredUnansweredPosts = filteredPosts.filter(p => !p.answered)

  // 필터링된 블랙리스트 데이터
  const filteredBlacklist = blacklist.filter(item => {
    if (blacklistSearchText) {
      const searchLower = blacklistSearchText.toLowerCase()
      const matchName = item.galleryName?.toLowerCase().includes(searchLower)
      const matchId = item.galleryId?.toLowerCase().includes(searchLower)
      const matchUrl = item.galleryUrl?.toLowerCase().includes(searchLower)
      const matchRemarks = item.remarks?.toLowerCase().includes(searchLower)

      if (!matchName && !matchId && !matchUrl && !matchRemarks) return false
    }

    return true
  })

  // 갤러리 테이블 row selection
  const galleryRowSelection = {
    selectedRowKeys: selectedGalleryIds,
    onChange: (selectedRowKeys: React.Key[]) => {
      setSelectedGalleryIds(selectedRowKeys as string[])
    },
  }

  // 블랙리스트 모달
  const showBlacklistModal = (item?: BlacklistedGallery) => {
    if (item) {
      setEditingBlacklist(item)
      blacklistForm.setFieldsValue(item)
    } else {
      setEditingBlacklist(null)
      blacklistForm.resetFields()
    }
    setBlacklistModalVisible(true)
  }

  const handleBlacklistModalOk = async () => {
    try {
      const values = await blacklistForm.validateFields()
      if (editingBlacklist) {
        await monitoringApi.updateBlacklistedGallery(editingBlacklist.id, values)
        message.success('블랙리스트가 수정되었습니다.')
      } else {
        await monitoringApi.createBlacklistedGallery(values)
        message.success('블랙리스트가 추가되었습니다.')
      }
      setBlacklistModalVisible(false)
      loadBlacklist()
    } catch (error) {
      message.error('저장 실패')
      console.error(error)
    }
  }

  const handleDeleteBlacklist = async (id: string) => {
    try {
      await monitoringApi.deleteBlacklistedGallery(id)
      message.success('블랙리스트가 삭제되었습니다.')
      loadBlacklist()
    } catch (error) {
      message.error('삭제 실패')
      console.error(error)
    }
  }

  const handleBulkDeleteBlacklist = async () => {
    if (selectedBlacklistIds.length === 0) {
      message.warning('삭제할 블랙리스트를 선택해주세요.')
      return
    }

    try {
      const result = await monitoringApi.bulkDeleteBlacklistedGalleries(selectedBlacklistIds)
      message.success(`${result.deletedCount}개의 블랙리스트가 삭제되었습니다.`)
      setSelectedBlacklistIds([])
      loadBlacklist()
    } catch (error) {
      message.error('일괄 삭제 실패')
      console.error(error)
    }
  }

  const handleSelectAllBlacklist = () => {
    setSelectedBlacklistIds(filteredBlacklist.map(item => item.id))
  }

  const handleDeselectAllBlacklist = () => {
    setSelectedBlacklistIds([])
  }

  // 쿠파스 수동 실행 모달
  const showCoupasModal = async () => {
    try {
      // localStorage에서 기본값 불러오기
      const savedDefaults = localStorage.getItem('coupasModalDefaults')
      let defaults: any = {}

      if (savedDefaults) {
        defaults = JSON.parse(savedDefaults)
      }

      // settings에서 워드프레스 정보 가져오기
      const settings = await getSettings()
      const accounts = settings.wordpressAccounts || []
      setWordpressAccounts(accounts)

      // 첫 번째 워드프레스 계정을 기본 선택으로 설정
      if (accounts.length > 0) {
        defaults = {
          ...defaults,
          wordpressId: accounts[0].id,
          // 게시물 URL은 기본값에서 제외 (매번 새로 입력해야 함)
          postUrl: '',
        }
      }

      coupasForm.setFieldsValue(defaults)
      setCoupasModalVisible(true)
    } catch (error) {
      console.error('워드프레스 설정 로드 실패:', error)
      coupasForm.resetFields()
      setCoupasModalVisible(true)
    }
  }

  const handleCoupasModalOk = async () => {
    try {
      const values = await coupasForm.validateFields()
      setCoupasLoading(true)

      // localStorage에 기본값 저장 (게시물 URL 제외)
      const { postUrl, ...defaultsToSave } = values
      localStorage.setItem('coupasModalDefaults', JSON.stringify(defaultsToSave))

      // 선택된 워드프레스 계정 정보를 찾아서 백엔드로 전달
      const selectedAccount = wordpressAccounts.find(acc => acc.id === values.wordpressId)

      const requestData = {
        postUrl: values.postUrl,
        wordpressId: values.wordpressId,
        loginId: values.loginId,
        loginPassword: values.loginPassword,
        nickname: values.nickname,
        password: values.password,
      }

      const result = await monitoringApi.executeManualCoupas(requestData)
      message.success(`${result.message} (작업 ID: ${result.jobId})`)
      setCoupasModalVisible(false)
      loadData()
    } catch (error) {
      message.error('쿠파스 작업 실패')
      console.error(error)
    } finally {
      setCoupasLoading(false)
    }
  }

  // 블랙리스트 테이블 row selection
  const blacklistRowSelection = {
    selectedRowKeys: selectedBlacklistIds,
    onChange: (selectedRowKeys: React.Key[]) => {
      setSelectedBlacklistIds(selectedRowKeys as string[])
    },
  }

  // 블랙리스트 테이블 컬럼
  const blacklistColumns: ColumnsType<BlacklistedGallery> = [
    {
      title: '갤러리명',
      dataIndex: 'galleryName',
      key: 'galleryName',
      render: (name: string | null) => name || '-',
    },
    {
      title: '갤러리 ID',
      dataIndex: 'galleryId',
      key: 'galleryId',
    },
    {
      title: '갤러리 URL',
      dataIndex: 'galleryUrl',
      key: 'galleryUrl',
      render: (url: string) => (
        <a
          href="#"
          onClick={e => {
            e.preventDefault()
            if (window.electronAPI?.openExternal) {
              window.electronAPI.openExternal(url)
            } else {
              window.open(url, '_blank', 'noopener,noreferrer')
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          {url}
        </a>
      ),
    },
    {
      title: '비고',
      dataIndex: 'remarks',
      key: 'remarks',
      ellipsis: true,
      render: (text: string | null) => text || '-',
    },
    {
      title: '등록일',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date: Date) => new Date(date).toLocaleString('ko-KR'),
    },
    {
      title: '작업',
      key: 'action',
      width: 150,
      render: (_, record: BlacklistedGallery) => (
        <Space size="small">
          <Button type="link" icon={<EditOutlined />} onClick={() => showBlacklistModal(record)} size="small">
            수정
          </Button>
          <Popconfirm
            title="정말 삭제하시겠습니까?"
            onConfirm={() => handleDeleteBlacklist(record.id)}
            okText="예"
            cancelText="아니오"
          >
            <Button type="link" danger icon={<DeleteOutlined />} size="small">
              삭제
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // 갤러리 테이블 컬럼
  const galleryColumns: ColumnsType<MonitoredGallery> = [
    {
      title: '상태',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (isActive: boolean) => <Tag color={isActive ? 'green' : 'default'}>{isActive ? '활성' : '비활성'}</Tag>,
    },
    {
      title: '타입',
      key: 'type',
      width: 120,
      render: (_, record: MonitoredGallery) => (
        <Space direction="vertical" size={0}>
          <Tag color={record.type === 'search' ? 'blue' : 'default'}>
            {record.type === 'search' ? '검색' : '갤러리'}
          </Tag>
          {record.actionType && (
            <Tag color={record.actionType === 'coupas' ? 'orange' : 'green'}>
              {record.actionType === 'coupas' ? '쿠파스' : '고정댓글'}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '갤러리명/검색어',
      key: 'name',
      render: (_, record: MonitoredGallery) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.galleryName || record.galleryId}</Text>
          {record.type === 'search' && record.searchKeyword && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              검색: {record.searchKeyword}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '갤러리 URL',
      dataIndex: 'galleryUrl',
      key: 'galleryUrl',
      render: (url: string) => (
        <a
          href="#"
          onClick={e => {
            e.preventDefault()
            if (window.electronAPI?.openExternal) {
              window.electronAPI.openExternal(url)
            } else {
              // fallback: 브라우저에서 열기
              window.open(url, '_blank', 'noopener,noreferrer')
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          {url}
        </a>
      ),
    },
    {
      title: '댓글 내용',
      dataIndex: 'commentText',
      key: 'commentText',
      ellipsis: true,
      render: (text: string | null) => text || <Text type="secondary">기본값 사용</Text>,
    },
    {
      title: '게시글 수',
      key: 'postCount',
      width: 100,
      render: (_, record: MonitoredGallery) => (
        <Space direction="vertical" size={0}>
          <Text>전체: {record.postCount || 0}</Text>
          <Text type="danger">미답변: {record.unansweredPostCount || 0}</Text>
        </Space>
      ),
    },
    {
      title: '마지막 확인',
      dataIndex: 'lastCheckedAt',
      key: 'lastCheckedAt',
      width: 150,
      render: (date: Date | null) => (date ? new Date(date).toLocaleString('ko-KR') : <Text type="secondary">-</Text>),
    },
    {
      title: '작업',
      key: 'action',
      width: 250,
      render: (_, record: MonitoredGallery) => (
        <Space size="small">
          <Tooltip title="갤러리 정보 크롤링">
            <Button type="default" icon={<ReloadOutlined />} onClick={() => handleCrawlGallery(record.id)} size="small">
              크롤링
            </Button>
          </Tooltip>
          <Button type="link" icon={<EditOutlined />} onClick={() => showModal(record)} size="small">
            수정
          </Button>
          <Button
            type="link"
            onClick={() => handleToggleActive(record.id)}
            size="small"
            style={{ color: record.isActive ? 'orange' : 'green' }}
          >
            {record.isActive ? '비활성화' : '활성화'}
          </Button>
          <Popconfirm
            title="정말 삭제하시겠습니까?"
            onConfirm={() => handleDeleteGallery(record.id)}
            okText="예"
            cancelText="아니오"
          >
            <Button type="link" danger icon={<DeleteOutlined />} size="small">
              삭제
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // 게시글 테이블 row selection
  const postRowSelection = {
    selectedRowKeys: selectedPostIds,
    onChange: (selectedRowKeys: React.Key[]) => {
      setSelectedPostIds(selectedRowKeys as string[])
    },
  }

  // 포스트 테이블 컬럼
  const postColumns: ColumnsType<MonitoredPost> = [
    {
      title: '상태',
      key: 'status',
      width: 120,
      render: (_, record: MonitoredPost) => (
        <Space direction="vertical" size={0}>
          <Tag
            color={record.answered ? 'success' : 'warning'}
            icon={record.answered ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
          >
            {record.answered ? '답변완료' : '미답변'}
          </Tag>
          {getAiStatusTag(record.approvedStatus, record.aiReason)}
        </Space>
      ),
    },
    {
      title: '갤러리',
      key: 'gallery',
      width: 150,
      render: (_, record: MonitoredPost) => record.gallery?.galleryName || record.gallery?.galleryId || '-',
    },
    {
      title: '제목',
      dataIndex: 'postTitle',
      key: 'postTitle',
      ellipsis: true,
      render: (title: string, record: MonitoredPost) => (
        <a
          href="#"
          onClick={e => {
            e.preventDefault()
            if (window.electronAPI?.openExternal) {
              window.electronAPI.openExternal(record.postUrl)
            } else {
              // fallback: 브라우저에서 열기
              window.open(record.postUrl, '_blank', 'noopener,noreferrer')
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          {title}
        </a>
      ),
    },
    {
      title: '작성자',
      dataIndex: 'authorName',
      key: 'authorName',
      width: 120,
    },
    {
      title: '발견 시각',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date: Date) => new Date(date).toLocaleString('ko-KR'),
    },
    {
      title: '답변 시각',
      dataIndex: 'answeredAt',
      key: 'answeredAt',
      width: 150,
      render: (date: Date | null) => (date ? new Date(date).toLocaleString('ko-KR') : '-'),
    },
    {
      title: '작업',
      key: 'action',
      width: 240,
      render: (_, record: MonitoredPost) => (
        <Space size="small">
          {!record.answered && (
            <Tooltip title="수동으로 댓글 달기">
              <Button
                type="primary"
                size="small"
                icon={<MessageOutlined />}
                onClick={() => handleAnswerPost(record.id)}
              >
                댓글달기
              </Button>
            </Tooltip>
          )}
          {record.approvedStatus === 'FAILED' && (
            <Tooltip title="AI 검증 재시도">
              <Button
                type="default"
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => handleRetryAiCheck(record.id)}
              >
                AI재시도
              </Button>
            </Tooltip>
          )}
          <Popconfirm
            title="이 게시글을 삭제하시겠습니까?"
            description="삭제된 게시글은 복구할 수 없습니다."
            onConfirm={async () => {
              try {
                await monitoringApi.deletePost(record.id)
                message.success('게시글이 삭제되었습니다.')
                loadData()
              } catch (error) {
                message.error('게시글 삭제 실패')
                console.error(error)
              }
            }}
            okText="예"
            cancelText="아니오"
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              삭제
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      {/* 상태 카드 */}
      <Card
        style={{ marginBottom: 16 }}
        extra={
          <Space>
            <Button icon={<PlusOutlined />} onClick={showCoupasModal} type="primary">
              쿠파스 수동 실행
            </Button>
            <Button icon={<SettingOutlined />} onClick={showSettingsModal}>
              모니터링 설정
            </Button>
          </Space>
        }
      >
        <Row gutter={16}>
          <Col span={4}>
            <Statistic title="전체 갤러리" value={status?.totalGalleries || 0} />
          </Col>
          <Col span={4}>
            <Statistic title="활성 갤러리" value={status?.activeGalleries || 0} />
          </Col>
          <Col span={4}>
            <Statistic title="전체 게시글" value={status?.totalPosts || 0} />
          </Col>
          <Col span={4}>
            <Statistic title="미답변 게시글" value={status?.unansweredPosts || 0} valueStyle={{ color: '#cf1322' }} />
          </Col>
          <Col span={4}>
            <Space direction="vertical">
              <Text strong>크롤링</Text>
              <Button
                type={status?.crawler.isRunning ? 'default' : 'primary'}
                icon={status?.crawler.isRunning ? <StopOutlined /> : <PlayCircleOutlined />}
                onClick={handleToggleCrawling}
              >
                {status?.crawler.isRunning ? '중지' : '시작'}
              </Button>
            </Space>
          </Col>
          <Col span={4}>
            <Space direction="vertical">
              <Text strong>자동 댓글</Text>
              <Button
                type={status?.autoComment.isRunning ? 'default' : 'primary'}
                icon={status?.autoComment.isRunning ? <StopOutlined /> : <PlayCircleOutlined />}
                onClick={handleToggleAutoComment}
              >
                {status?.autoComment.isRunning ? '중지' : '시작'}
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 탭 */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'blacklist',
            label: '블랙리스트',
            children: (
              <Card
                title="블랙리스트 관리"
                extra={
                  <Space>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => showBlacklistModal()}>
                      블랙리스트 추가
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={loadBlacklist}>
                      새로고침
                    </Button>
                  </Space>
                }
              >
                {/* 블랙리스트 검색 */}
                <Space style={{ marginBottom: 16 }} wrap>
                  <Input
                    placeholder="갤러리명, ID, URL, 비고 검색"
                    prefix={<SearchOutlined />}
                    value={blacklistSearchText}
                    onChange={e => setBlacklistSearchText(e.target.value)}
                    style={{ width: 300 }}
                    allowClear
                  />
                </Space>

                {/* 블랙리스트 선택 툴바 */}
                {selectedBlacklistIds.length > 0 && (
                  <Card
                    style={{ marginBottom: 16, backgroundColor: '#fff1f0', borderColor: '#ff4d4f' }}
                    bodyStyle={{ padding: '12px 16px' }}
                  >
                    <Space wrap>
                      <Text strong style={{ color: '#ff4d4f' }}>
                        {selectedBlacklistIds.length}개 선택됨
                      </Text>
                      <Button size="small" onClick={handleDeselectAllBlacklist}>
                        선택 해제
                      </Button>
                      <Button
                        size="small"
                        onClick={handleSelectAllBlacklist}
                        disabled={selectedBlacklistIds.length === filteredBlacklist.length}
                      >
                        전체 선택 ({filteredBlacklist.length}개)
                      </Button>
                      <Popconfirm
                        title={`${selectedBlacklistIds.length}개의 블랙리스트를 삭제하시겠습니까?`}
                        onConfirm={handleBulkDeleteBlacklist}
                        okText="예"
                        cancelText="아니오"
                      >
                        <Button danger size="small" icon={<DeleteOutlined />}>
                          선택 삭제
                        </Button>
                      </Popconfirm>
                    </Space>
                  </Card>
                )}
                <Table
                  columns={blacklistColumns}
                  dataSource={filteredBlacklist}
                  rowKey="id"
                  loading={loading}
                  rowSelection={blacklistRowSelection}
                />
              </Card>
            ),
          },
          {
            key: 'galleries',
            label: '갤러리 관리',
            children: (
              <Card
                title="갤러리 목록"
                extra={
                  <Space>
                    <Button icon={<DownloadOutlined />} onClick={handleGalleryListDownload}>
                      목록 다운로드
                    </Button>
                    <Button icon={<DownloadOutlined />} onClick={handleExcelSampleDownload}>
                      엑셀 샘플
                    </Button>
                    <Upload beforeUpload={handleExcelUpload} accept=".xlsx,.xls" showUploadList={false}>
                      <Button icon={<UploadOutlined />}>엑셀 업로드</Button>
                    </Upload>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()}>
                      모니터링 추가
                    </Button>
                    <Button icon={<ReloadOutlined />} onClick={loadData}>
                      새로고침
                    </Button>
                  </Space>
                }
              >
                {/* 갤러리 검색/필터 */}
                <Space style={{ marginBottom: 16 }} wrap>
                  <Input
                    placeholder="갤러리명, ID, URL, 댓글 내용 검색"
                    prefix={<SearchOutlined />}
                    value={gallerySearchText}
                    onChange={e => setGallerySearchText(e.target.value)}
                    style={{ width: 300 }}
                    allowClear
                  />
                  <Select value={galleryStatusFilter} onChange={setGalleryStatusFilter} style={{ width: 120 }}>
                    <Select.Option value="all">전체 상태</Select.Option>
                    <Select.Option value="active">활성</Select.Option>
                    <Select.Option value="inactive">비활성</Select.Option>
                  </Select>
                </Space>

                {/* 갤러리 선택 툴바 */}
                {selectedGalleryIds.length > 0 && (
                  <Card
                    style={{ marginBottom: 16, backgroundColor: '#f0f5ff', borderColor: '#1890ff' }}
                    bodyStyle={{ padding: '12px 16px' }}
                  >
                    <Space wrap>
                      <Text strong style={{ color: '#1890ff' }}>
                        {selectedGalleryIds.length}개 선택됨
                      </Text>
                      <Button size="small" onClick={handleDeselectAllGalleries}>
                        선택 해제
                      </Button>
                      <Button
                        size="small"
                        onClick={handleSelectAllGalleries}
                        disabled={selectedGalleryIds.length === filteredGalleries.length}
                      >
                        전체 선택 ({filteredGalleries.length}개)
                      </Button>
                      <Popconfirm
                        title={`${selectedGalleryIds.length}개의 갤러리 정보를 크롤링하시겠습니까?`}
                        description="갤러리 ID와 이름이 자동으로 업데이트됩니다."
                        onConfirm={handleBulkCrawlGalleries}
                        okText="예"
                        cancelText="아니오"
                      >
                        <Button size="small" icon={<ReloadOutlined />}>
                          선택 크롤링
                        </Button>
                      </Popconfirm>
                      <Popconfirm
                        title={`${selectedGalleryIds.length}개의 갤러리를 활성화하시겠습니까?`}
                        onConfirm={handleBulkActivateGalleries}
                        okText="예"
                        cancelText="아니오"
                      >
                        <Button type="primary" size="small">
                          선택 활성화
                        </Button>
                      </Popconfirm>
                      <Popconfirm
                        title={`${selectedGalleryIds.length}개의 갤러리를 비활성화하시겠습니까?`}
                        onConfirm={handleBulkDeactivateGalleries}
                        okText="예"
                        cancelText="아니오"
                      >
                        <Button size="small" style={{ color: 'orange', borderColor: 'orange' }}>
                          선택 비활성화
                        </Button>
                      </Popconfirm>
                      <Popconfirm
                        title={`${selectedGalleryIds.length}개의 갤러리를 삭제하시겠습니까?`}
                        onConfirm={handleBulkDeleteGalleries}
                        okText="예"
                        cancelText="아니오"
                      >
                        <Button danger size="small" icon={<DeleteOutlined />}>
                          선택 삭제
                        </Button>
                      </Popconfirm>
                    </Space>
                  </Card>
                )}
                <Table
                  columns={galleryColumns}
                  dataSource={filteredGalleries}
                  rowKey="id"
                  loading={loading}
                  rowSelection={galleryRowSelection}
                />
              </Card>
            ),
          },
          {
            key: 'posts',
            label: '게시글 목록',
            children: (
              <Card
                title="발견된 게시글"
                extra={
                  <Space>
                    <Button icon={<ReloadOutlined />} onClick={loadData}>
                      새로고침
                    </Button>
                  </Space>
                }
              >
                {/* 게시글 검색/필터 */}
                <Space style={{ marginBottom: 16 }} wrap>
                  <Input
                    placeholder="제목, 작성자, 갤러리 검색"
                    prefix={<SearchOutlined />}
                    value={postSearchText}
                    onChange={e => setPostSearchText(e.target.value)}
                    style={{ width: 300 }}
                    allowClear
                  />
                  <Select value={postStatusFilter} onChange={setPostStatusFilter} style={{ width: 120 }}>
                    <Select.Option value="all">전체 상태</Select.Option>
                    <Select.Option value="answered">답변완료</Select.Option>
                    <Select.Option value="unanswered">미답변</Select.Option>
                  </Select>
                  <Select
                    value={postGalleryFilter}
                    onChange={setPostGalleryFilter}
                    style={{ width: 200 }}
                    placeholder="갤러리 선택"
                    allowClear
                  >
                    {galleries.map(gallery => (
                      <Select.Option key={gallery.id} value={gallery.id}>
                        {gallery.galleryName || gallery.galleryId}
                      </Select.Option>
                    ))}
                  </Select>
                </Space>

                {/* 게시글 선택 툴바 */}
                {selectedPostIds.length > 0 && (
                  <Card
                    style={{ marginBottom: 16, backgroundColor: '#f6ffed', borderColor: '#52c41a' }}
                    bodyStyle={{ padding: '12px 16px' }}
                  >
                    <Space wrap>
                      <Text strong style={{ color: '#52c41a' }}>
                        {selectedPostIds.length}개 선택됨
                      </Text>
                      <Button size="small" onClick={handleDeselectAllPosts}>
                        선택 해제
                      </Button>
                      <Button
                        size="small"
                        onClick={handleSelectAllPosts}
                        disabled={selectedPostIds.length === filteredUnansweredPosts.length}
                      >
                        미답변 전체 선택 ({filteredUnansweredPosts.length}개)
                      </Button>
                      <Popconfirm
                        title={`선택한 ${selectedPostIds.length}개 게시글에 댓글을 달겠습니까?`}
                        description="미답변 게시글에만 댓글이 달립니다."
                        onConfirm={handleBulkAnswerPosts}
                        okText="예"
                        cancelText="아니오"
                      >
                        <Button type="primary" size="small" icon={<MessageOutlined />}>
                          선택 댓글달기
                        </Button>
                      </Popconfirm>
                      <Popconfirm
                        title={`${selectedPostIds.length}개의 게시글을 삭제하시겠습니까?`}
                        description="삭제된 게시글은 복구할 수 없습니다."
                        onConfirm={handleBulkDeletePosts}
                        okText="예"
                        cancelText="아니오"
                      >
                        <Button danger size="small" icon={<DeleteOutlined />}>
                          선택 삭제
                        </Button>
                      </Popconfirm>
                    </Space>
                  </Card>
                )}
                <Table
                  columns={postColumns}
                  dataSource={filteredPosts}
                  rowKey="id"
                  loading={loading}
                  rowSelection={postRowSelection}
                />
              </Card>
            ),
          },
        ]}
      />

      {/* 모니터링 추가/수정 모달 */}
      <Modal
        title={editingGallery ? '모니터링 수정' : '모니터링 추가'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={800}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="모니터링 타입"
                name="type"
                initialValue="gallery"
                help="갤러리: 특정 갤러리의 새 글 모니터링 / 검색: 키워드 검색 결과 모니터링"
              >
                <Select>
                  <Select.Option value="gallery">갤러리</Select.Option>
                  <Select.Option value="search">검색</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="자동 작업 타입" name="actionType" help="새 글 발견 시 자동으로 수행할 작업">
                <Select placeholder="선택 안함" allowClear>
                  <Select.Option value="fixed_comment">고정 댓글</Select.Option>
                  <Select.Option value="coupas">쿠파스 (AI 검사 후 블로그 링크)</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item noStyle shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}>
            {({ getFieldValue }) =>
              getFieldValue('type') === 'search' ? (
                <>
                  <Form.Item
                    label="검색 키워드"
                    name="searchKeyword"
                    rules={[{ required: true, message: '검색 키워드를 입력하세요' }]}
                  >
                    <Input placeholder="예: 추천" />
                  </Form.Item>
                  <Form.Item label="검색 정렬" name="searchSort" initialValue="latest">
                    <Radio.Group>
                      <Radio value="latest">최신순</Radio>
                      <Radio value="accuracy">정확도순</Radio>
                    </Radio.Group>
                  </Form.Item>
                  {editingGallery && (
                    <>
                      <Form.Item label="갤러리 ID" name="galleryId">
                        <Input disabled />
                      </Form.Item>
                      <Form.Item label="이름" name="galleryName">
                        <Input disabled />
                      </Form.Item>
                    </>
                  )}
                </>
              ) : (
                <>
                  <Form.Item
                    label="갤러리 URL"
                    name="galleryUrl"
                    rules={[{ required: true, message: '갤러리 URL을 입력하세요' }]}
                    help={
                      editingGallery
                        ? 'URL을 변경하면 갤러리 ID와 이름이 자동으로 업데이트됩니다'
                        : 'URL을 입력하면 갤러리 ID와 이름이 자동으로 파싱됩니다'
                    }
                  >
                    <Input placeholder="https://gall.dcinside.com/board/lists/?id=programming" />
                  </Form.Item>
                  {editingGallery && (
                    <>
                      <Form.Item label="갤러리 ID" name="galleryId">
                        <Input placeholder="programming" disabled />
                      </Form.Item>
                      <Form.Item label="갤러리명" name="galleryName">
                        <Input placeholder="프로그래밍 갤러리" disabled />
                      </Form.Item>
                    </>
                  )}
                </>
              )
            }
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.actionType !== currentValues.actionType}
          >
            {({ getFieldValue }) =>
              getFieldValue('actionType') === 'coupas' ? (
                <Form.Item
                  label="AI 프롬프트"
                  name="aiPromptCode"
                  help="게시물 적합성을 판단하는 AI 프롬프트를 선택하세요 (미선택 시 기본 프롬프트 사용)"
                >
                  <Select placeholder="기본 프롬프트 사용" allowClear>
                    {aiPrompts.map(prompt => (
                      <Select.Option key={prompt.code} value={prompt.code}>
                        <div>
                          <Text strong>{prompt.name}</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {prompt.description}
                          </Text>
                        </div>
                      </Select.Option>
                    ))}
                  </Select>
                </Form.Item>
              ) : (
                <Form.Item label="댓글 내용" name="commentText">
                  <TextArea rows={4} placeholder="이 갤러리에 달 댓글 내용 (미입력 시 기본값 사용)" />
                </Form.Item>
              )
            }
          </Form.Item>

          <Form.Item label="로그인 ID (회원일 경우)" name="loginId">
            <Input placeholder="로그인 ID" />
          </Form.Item>
          <Form.Item label="로그인 비밀번호 (회원일 경우)" name="loginPassword">
            <Input.Password placeholder="로그인 비밀번호" />
          </Form.Item>
          <Form.Item label="닉네임 (비회원일 경우)" name="nickname">
            <Input placeholder="닉네임" />
          </Form.Item>
          <Form.Item label="비밀번호 (비회원일 경우)" name="password">
            <Input.Password placeholder="비밀번호" />
          </Form.Item>
          <Form.Item label="활성화" name="isActive" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* 모니터링 설정 모달 */}
      <Modal
        title="모니터링 설정"
        open={settingsModalVisible}
        onOk={handleSettingsSave}
        onCancel={() => setSettingsModalVisible(false)}
        width={700}
      >
        <Form form={settingsForm} layout="vertical">
          <Form.Item label="댓글 목록" extra="여러 개의 댓글을 등록하고 랜덤 또는 순차로 사용할 수 있습니다.">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  placeholder="댓글 내용 입력"
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onPressEnter={handleAddComment}
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddComment}>
                  추가
                </Button>
              </Space.Compact>

              <Form.Item name="comments" noStyle>
                <Input type="hidden" />
              </Form.Item>

              {comments.length > 0 && (
                <List
                  size="small"
                  bordered
                  dataSource={comments}
                  style={{ width: '100%' }}
                  renderItem={(comment, index) => (
                    <List.Item
                      actions={[
                        <Button
                          type="link"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={() => handleStartEditComment(index)}
                          key="edit"
                        >
                          수정
                        </Button>,
                        <Popconfirm
                          title="이 댓글을 삭제하시겠습니까?"
                          onConfirm={() => handleRemoveComment(index)}
                          okText="삭제"
                          cancelText="취소"
                          key="delete"
                        >
                          <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                            삭제
                          </Button>
                        </Popconfirm>,
                      ]}
                    >
                      {comment}
                    </List.Item>
                  )}
                />
              )}
            </Space>
          </Form.Item>

          <Form.Item
            label="댓글 선택 방식"
            name="commentSelectionMethod"
            extra="등록된 댓글이 여러 개일 때 사용할 방식을 선택합니다."
          >
            <Radio.Group>
              <Space direction="vertical">
                <Radio value="random">랜덤 - 등록된 댓글 중 무작위로 선택</Radio>
                <Radio value="sequential">순차 - 등록된 댓글을 순서대로 사용</Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          {/* 접두어/접미사 템플릿 섹션 */}
          <Card size="small" title="댓글 템플릿 (접두어/접미사)" style={{ marginTop: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                댓글 앞뒤에 랜덤으로 추가할 텍스트를 설정합니다. 예: "좋은 정보 감사합니다!" → "유용한 정보 감사합니다!
                도움됐어요"
              </Text>

              {/* 접두어 관리 */}
              <div>
                <Text strong>접두어 (앞에 추가)</Text>
                <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
                  <Space.Compact style={{ width: '100%' }}>
                    <Input
                      placeholder="접두어 입력 (예: 좋은 정보, 유용한 글)"
                      value={newPrefix}
                      onChange={e => setNewPrefix(e.target.value)}
                      onPressEnter={handleAddPrefix}
                    />
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAddPrefix}>
                      추가
                    </Button>
                  </Space.Compact>

                  <Form.Item name="commentPrefixes" noStyle>
                    <Input type="hidden" />
                  </Form.Item>

                  {prefixes.length > 0 && (
                    <List
                      size="small"
                      bordered
                      dataSource={prefixes}
                      style={{ width: '100%' }}
                      renderItem={(prefix, index) => (
                        <List.Item
                          actions={[
                            <Popconfirm
                              title="이 접두어를 삭제하시겠습니까?"
                              onConfirm={() => handleRemovePrefix(index)}
                              okText="삭제"
                              cancelText="취소"
                              key="delete"
                            >
                              <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                                삭제
                              </Button>
                            </Popconfirm>,
                          ]}
                        >
                          {prefix}
                        </List.Item>
                      )}
                    />
                  )}
                </Space>
              </div>

              {/* 접미사 관리 */}
              <div>
                <Text strong>접미사 (뒤에 추가)</Text>
                <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
                  <Space.Compact style={{ width: '100%' }}>
                    <Input
                      placeholder="접미사 입력 (예: 감사합니다, 도움됐어요)"
                      value={newSuffix}
                      onChange={e => setNewSuffix(e.target.value)}
                      onPressEnter={handleAddSuffix}
                    />
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleAddSuffix}>
                      추가
                    </Button>
                  </Space.Compact>

                  <Form.Item name="commentSuffixes" noStyle>
                    <Input type="hidden" />
                  </Form.Item>

                  {suffixes.length > 0 && (
                    <List
                      size="small"
                      bordered
                      dataSource={suffixes}
                      style={{ width: '100%' }}
                      renderItem={(suffix, index) => (
                        <List.Item
                          actions={[
                            <Popconfirm
                              title="이 접미사를 삭제하시겠습니까?"
                              onConfirm={() => handleRemoveSuffix(index)}
                              okText="삭제"
                              cancelText="취소"
                              key="delete"
                            >
                              <Button type="link" danger size="small" icon={<DeleteOutlined />}>
                                삭제
                              </Button>
                            </Popconfirm>,
                          ]}
                        >
                          {suffix}
                        </List.Item>
                      )}
                    />
                  )}
                </Space>
              </div>
            </Space>
          </Card>
        </Form>
      </Modal>

      {/* 댓글 수정 모달 */}
      <Modal
        title="댓글 수정"
        open={editingCommentIndex !== null}
        onOk={handleSaveEditComment}
        onCancel={handleCancelEditComment}
        okText="저장"
        cancelText="취소"
      >
        <Input.TextArea
          rows={4}
          value={editingCommentValue}
          onChange={e => setEditingCommentValue(e.target.value)}
          placeholder="댓글 내용을 입력하세요..."
          maxLength={500}
          showCount
        />
      </Modal>

      {/* 블랙리스트 추가/수정 모달 */}
      <Modal
        title={editingBlacklist ? '블랙리스트 수정' : '블랙리스트 추가'}
        open={blacklistModalVisible}
        onOk={handleBlacklistModalOk}
        onCancel={() => setBlacklistModalVisible(false)}
        width={600}
      >
        <Form form={blacklistForm} layout="vertical">
          <Form.Item
            label="갤러리 URL"
            name="galleryUrl"
            rules={[{ required: true, message: '갤러리 URL을 입력하세요' }]}
            help={
              editingBlacklist
                ? 'URL을 변경하면 갤러리 ID와 이름이 자동으로 업데이트됩니다'
                : 'URL을 입력하면 갤러리 ID와 이름이 자동으로 파싱됩니다'
            }
          >
            <Input placeholder="https://gall.dcinside.com/board/lists/?id=programming" />
          </Form.Item>
          {editingBlacklist && (
            <>
              <Form.Item label="갤러리 ID" name="galleryId">
                <Input placeholder="programming" disabled />
              </Form.Item>
              <Form.Item label="갤러리명" name="galleryName">
                <Input placeholder="프로그래밍 갤러리" disabled />
              </Form.Item>
            </>
          )}
          <Form.Item label="비고" name="remarks">
            <TextArea rows={3} placeholder="이 갤러리를 블랙리스트에 추가한 이유를 입력하세요" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 쿠파스 수동 실행 모달 */}
      <Modal
        title="쿠파스 수동 실행"
        open={coupasModalVisible}
        onOk={handleCoupasModalOk}
        onCancel={() => setCoupasModalVisible(false)}
        width={600}
        confirmLoading={coupasLoading}
      >
        <Form form={coupasForm} layout="vertical">
          <Form.Item
            label="게시물 URL"
            name="postUrl"
            rules={[{ required: true, message: '게시물 URL을 입력하세요' }]}
            help="쿠파스 작업을 실행할 디시인사이드 게시물 URL"
          >
            <Input placeholder="https://gall.dcinside.com/board/view/?id=..." />
          </Form.Item>

          {/* 워드프레스 계정 선택 */}
          {wordpressAccounts.length > 0 && (
            <Form.Item
              label="워드프레스 계정 선택"
              name="wordpressId"
              rules={[{ required: true, message: '워드프레스 계정을 선택하세요' }]}
              help="저장된 워드프레스 계정을 선택하세요"
            >
              <Select placeholder="워드프레스 계정을 선택하세요">
                {wordpressAccounts.map(account => (
                  <Select.Option key={account.id} value={account.id}>
                    {account.name} ({account.url})
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Form.Item label="로그인 ID (회원일 경우)" name="loginId">
            <Input placeholder="디시인사이드 로그인 ID" />
          </Form.Item>

          <Form.Item label="로그인 비밀번호 (회원일 경우)" name="loginPassword">
            <Input.Password placeholder="디시인사이드 로그인 비밀번호" />
          </Form.Item>

          <Form.Item label="닉네임 (비회원일 경우)" name="nickname">
            <Input placeholder="닉네임" />
          </Form.Item>

          <Form.Item label="비밀번호 (비회원일 경우)" name="password">
            <Input.Password placeholder="비밀번호" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default PostMonitoring
