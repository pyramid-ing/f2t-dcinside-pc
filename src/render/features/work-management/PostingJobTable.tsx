import {
  Button,
  Input,
  message,
  Modal,
  Popconfirm,
  Popover,
  Select,
  Space,
  Table,
  Tag,
  Checkbox,
  InputNumber,
  Divider,
  DatePicker,
} from 'antd'
import { LinkOutlined } from '@ant-design/icons'
import React, { useEffect, useState } from 'react'
import styled from 'styled-components'
import {
  bulkApplyInterval,
  bulkPendingToRequest,
  bulkRetryDeleteJobs,
  bulkUpdateAutoDelete,
  deleteJob,
  deleteJobs,
  getJobLogs,
  getJobs,
  getLatestJobLog,
  pendingToRequest,
  retryJob,
  retryDeleteJob,
  retryJobs,
  updateJobAutoDeleteMinutes,
  updateJobScheduledAt,
  updateViewCounts,
  exportJobsToExcel,
} from '@render/api'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'
import {
  JobLog,
  PostJob,
  JOB_STATUS,
  JOB_STATUS_LABEL,
  JOB_STATUS_COLOR,
  JOB_STATUS_OPTIONS,
  JOB_TYPE_OPTIONS,
  JobStatus,
  JobType,
  JOB_TYPE,
} from '@render/api/type'
import { SelectionState, BulkActionRequest, JobFilters } from '@render/types/selection'
import { BulkActionType } from '@render/types/bulk-action.enum'
import { SelectionMode } from '@render/types/selection-mode.enum'

const ResultCell = styled.div`
  max-width: 100%;
  word-break: break-word;
  line-height: 1.5;

  .result-text {
    font-size: 14px;
    line-height: 1.6;
    margin-bottom: 4px;
  }

  .success-text {
    color: #16a34a;
    font-weight: 500;
  }

  .error-text {
    color: #dc2626;
    font-weight: 500;
  }

  .pending-text {
    color: #2563eb;
    font-weight: 500;
  }

  .processing-text {
    color: #d97706;
    font-weight: 500;
  }

  .hover-hint {
    cursor: help;
    padding: 4px 8px;
    border-radius: 6px;
    transition: background-color 0.2s;

    &:hover {
      background-color: rgba(59, 130, 246, 0.1);
    }
  }
`

const PopoverContent = styled.div`
  max-width: 400px;

  .popover-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 16px;
    font-weight: 600;

    &.success {
      color: #16a34a;
    }

    &.error {
      color: #dc2626;
    }

    &.pending {
      color: #2563eb;
    }

    &.processing {
      color: #d97706;
    }
  }

  .popover-message {
    background: #f8fafc;
    padding: 12px;
    border-radius: 8px;
    font-size: 13px;
    line-height: 1.6;
    color: #475569;
    border-left: 3px solid #e2e8f0;
    white-space: pre-wrap;
    word-break: break-word;

    &.success {
      background: #f0fdf4;
      border-left-color: #16a34a;
      color: #15803d;
    }

    &.error {
      background: #fef2f2;
      border-left-color: #dc2626;
      color: #b91c1c;
    }

    &.pending {
      background: #eff6ff;
      border-left-color: #2563eb;
      color: #1e40af;
    }

    &.processing {
      background: #fffbeb;
      border-left-color: #d97706;
      color: #a16207;
    }
  }

  .result-url {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #e2e8f0;

    a {
      color: #1890ff;
      text-decoration: none;
      font-weight: 500;

      &:hover {
        text-decoration: underline;
      }
    }
  }
`

// 상태별 기본 메시지
function getDefaultMessage(status: JobStatus): string {
  switch (status) {
    case JOB_STATUS.PENDING:
      return '처리 대기 중입니다.'
    case JOB_STATUS.PROCESSING:
      return '현재 처리 중입니다.'
    case JOB_STATUS.COMPLETED:
      return '성공적으로 완료되었습니다.'
    case JOB_STATUS.FAILED:
      return '처리 중 오류가 발생했습니다.'
    default:
      return '알 수 없는 상태입니다.'
  }
}

// 상태별 타입 반환
function getStatusType(status: JobStatus): string {
  switch (status) {
    case JOB_STATUS.COMPLETED:
      return 'success'
    case JOB_STATUS.FAILED:
      return 'error'
    case JOB_STATUS.PENDING:
      return 'pending'
    case JOB_STATUS.PROCESSING:
      return 'processing'
    default:
      return 'pending'
  }
}

// 상태별 아이콘
function getStatusIcon(status: JobStatus): string {
  switch (status) {
    case JOB_STATUS.PENDING:
      return '⏳'
    case JOB_STATUS.PROCESSING:
      return '⚙️'
    case JOB_STATUS.COMPLETED:
      return '🎉'
    case JOB_STATUS.FAILED:
      return '⚠️'
    default:
      return '❓'
  }
}

// 상태별 제목
function getStatusTitle(status: JobStatus): string {
  switch (status) {
    case JOB_STATUS.PENDING:
      return '대기 중 상세 정보'
    case JOB_STATUS.PROCESSING:
      return '처리 중 상세 정보'
    case JOB_STATUS.COMPLETED:
      return '완료 상세 정보'
    case JOB_STATUS.FAILED:
      return '실패 원인 상세'
    default:
      return '상세 정보'
  }
}

// 갤러리 ID 추출 함수
function extractGalleryId(url: string): string {
  if (!url) return '-'
  try {
    const match = url.match(/[?&]id=([^&]+)/)
    return match ? match[1] : url
  } catch {
    return url
  }
}

const PostingJobTable: React.FC = () => {
  const [data, setData] = useState<PostJob[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<JobStatus | ''>('')
  const [typeFilter, setTypeFilter] = useState<JobType | ''>('')
  const [searchText, setSearchText] = useState('')
  const [sortField, setSortField] = useState('updatedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalCount, setTotalCount] = useState(0)

  // JobLog 모달 관련 state
  const [logModalVisible, setLogModalVisible] = useState(false)
  const [currentJobId, setCurrentJobId] = useState<string>('')
  const [jobLogs, setJobLogs] = useState<JobLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [latestLogs, setLatestLogs] = useState<Record<string, JobLog>>({})

  // 벌크 작업 관련 상태
  const [selection, setSelection] = useState<SelectionState>({
    mode: SelectionMode.PAGE,
    includeIds: new Set(),
    excludedIds: new Set(),
  })
  const [bulkRetryLoading, setBulkRetryLoading] = useState(false)
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false)

  const [editingStatusJobId, setEditingStatusJobId] = useState<string | null>(null)

  const [downloadingJobId, setDownloadingJobId] = useState<string | null>(null)

  const [intervalStart, setIntervalStart] = useState<number>(60)
  const [intervalEnd, setIntervalEnd] = useState<number>(90)
  const [intervalUnit, setIntervalUnit] = useState<'sec' | 'min'>('min')
  const [intervalApplyLoading, setIntervalApplyLoading] = useState(false)

  // 툴바: 등록후자동삭제(분)
  const [autoDeleteMinutes, setAutoDeleteMinutes] = useState<number | null>(null)
  const [autoDeleteApplyLoading, setAutoDeleteApplyLoading] = useState(false)

  // 툴바: 자동삭제 제거
  const [autoDeleteRemoveLoading, setAutoDeleteRemoveLoading] = useState(false)

  // 툴바: 조회수 가져오기
  const [viewCountUpdateLoading, setViewCountUpdateLoading] = useState(false)

  // 툴바: 엑셀 다운로드
  const [excelDownloadLoading, setExcelDownloadLoading] = useState(false)

  useEffect(() => {
    setCurrentPage(1)
    fetchJobs()
  }, [statusFilter, typeFilter, searchText, sortField, sortOrder])

  useEffect(() => {
    fetchJobs()
  }, [currentPage, pageSize])

  useEffect(() => {
    const timer = setInterval(() => {
      fetchJobs()
    }, 5000)
    return () => clearInterval(timer)
  }, [statusFilter, typeFilter, searchText, sortField, sortOrder, currentPage, pageSize])

  // 현재 필터 조건 생성
  const getCurrentFilters = (): JobFilters => ({
    status: statusFilter || undefined,
    type: JOB_TYPE.POST, // 글쓰기 작업만
    search: searchText || undefined,
    orderBy: sortField,
    order: sortOrder,
  })

  // 체크 상태 확인 함수
  const isChecked = (id: string): boolean => {
    if (selection.mode === SelectionMode.ALL) {
      return !selection.excludedIds.has(id)
    } else {
      return selection.includeIds.has(id)
    }
  }

  // 현재 페이지의 모든 ID
  const currentPageIds = data.map(job => job.id)

  // 선택된 개수 계산
  const getSelectedCount = (): number => {
    if (selection.mode === SelectionMode.ALL) {
      return totalCount - selection.excludedIds.size
    } else {
      return selection.includeIds.size
    }
  }

  const fetchJobs = async () => {
    setLoading(true)
    try {
      const res = await getJobs({
        status: statusFilter || undefined,
        type: JOB_TYPE.POST, // 글쓰기 작업만
        search: searchText || undefined,
        orderBy: sortField,
        order: sortOrder,
        page: currentPage,
        limit: pageSize,
      })

      setData(res.data as PostJob[])
      setTotalCount(res.pagination.totalCount)

      // 최신 로그들을 가져와서 요약 표시용으로 저장
      const latestLogsData: Record<string, JobLog> = {}
      for (const job of res.data) {
        try {
          const logRes = await getLatestJobLog(job.id)
          latestLogsData[job.id] = logRes
        } catch {}
      }
      setLatestLogs(latestLogsData)
    } catch {
      setData([])
    }
    setLoading(false)
  }

  const showJobLogs = async (jobId: string) => {
    setCurrentJobId(jobId)
    setLogModalVisible(true)
    setLogsLoading(true)
    try {
      const res = await getJobLogs(jobId)
      setJobLogs(res)
    } catch {
      setJobLogs([])
      message.error('로그를 불러오는데 실패했습니다')
    }
    setLogsLoading(false)
  }

  const handleRetry = async (id: string) => {
    try {
      const res = await retryJob(id)
      if (res.success) {
        message.success('재시도 요청 완료')
        fetchJobs()
      } else {
        message.error('message' in res ? res.message : '재시도 실패')
      }
    } catch (error: any) {
      message.error(error?.message || '재시도 실패')
    }
  }

  const handleRetryDelete = async (id: string) => {
    try {
      const res = await retryDeleteJob(id)
      if (res.success) {
        message.success('삭제 재시도 요청 완료')
        fetchJobs()
      } else {
        message.error('message' in res ? res.message : '삭제 재시도 실패')
      }
    } catch (error: any) {
      message.error(error?.message || '삭제 재시도 실패')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await deleteJob(id)
      if (res.success) {
        message.success('작업이 삭제되었습니다')
        fetchJobs()
      } else {
        message.error('message' in res ? res.message : '삭제 실패')
      }
    } catch (error: any) {
      message.error(error?.message || '삭제 실패')
    }
  }

  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
    if (sorter.field && sorter.order) {
      setSortField(sorter.field)
      setSortOrder(sorter.order === 'ascend' ? 'asc' : 'desc')
      setCurrentPage(1)
    }
  }

  // 전체 선택 핸들러 (현재 페이지만)
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSelectedIds = new Set([...selection.includeIds, ...currentPageIds])
      setSelection({
        mode: SelectionMode.PAGE,
        includeIds: newSelectedIds,
        excludedIds: new Set(),
      })
    } else {
      const newSelectedIds = new Set([...selection.includeIds].filter(id => !currentPageIds.includes(id)))
      setSelection({
        mode: SelectionMode.PAGE,
        includeIds: newSelectedIds,
        excludedIds: new Set(),
      })
    }
  }

  // 전체 페이지 선택 핸들러 (필터 조건에 맞는 모든 데이터)
  const handleSelectAllPages = (checked: boolean) => {
    if (checked) {
      setSelection({
        mode: SelectionMode.ALL,
        includeIds: new Set(),
        excludedIds: new Set(),
      })
    } else {
      setSelection({
        mode: SelectionMode.PAGE,
        includeIds: new Set(),
        excludedIds: new Set(),
      })
    }
  }

  // 개별 선택 핸들러
  const handleSelectJob = (jobId: string, checked: boolean) => {
    if (selection.mode === SelectionMode.PAGE) {
      const newSelectedIds = new Set(selection.includeIds)
      if (checked) {
        newSelectedIds.add(jobId)
      } else {
        newSelectedIds.delete(jobId)
      }
      setSelection({
        mode: SelectionMode.PAGE,
        includeIds: newSelectedIds,
        excludedIds: new Set(),
      })
    } else {
      const newExcludedIds = new Set(selection.excludedIds)
      if (checked) {
        newExcludedIds.delete(jobId)
      } else {
        newExcludedIds.add(jobId)
      }
      setSelection({
        mode: SelectionMode.ALL,
        includeIds: new Set(),
        excludedIds: newExcludedIds,
      })
    }
  }

  // 벌크 재시도 핸들러
  const handleBulkRetry = async () => {
    const selectedCount = getSelectedCount()
    if (selectedCount === 0) {
      message.warning('재시도할 작업을 선택해주세요.')
      return
    }

    setBulkRetryLoading(true)
    try {
      const request: BulkActionRequest = {
        mode: selection.mode,
        filters: getCurrentFilters(),
        includeIds: selection.mode === SelectionMode.PAGE ? Array.from(selection.includeIds) : undefined,
        excludeIds: selection.mode === SelectionMode.ALL ? Array.from(selection.excludedIds) : undefined,
        action: BulkActionType.RETRY,
      }

      const response = await retryJobs(request)
      message.success(response.message)

      // 선택 상태 초기화
      setSelection({
        mode: SelectionMode.PAGE,
        includeIds: new Set(),
        excludedIds: new Set(),
      })
      fetchJobs()
    } catch (error: any) {
      message.error(error.message || '벌크 재시도에 실패했습니다.')
    }
    setBulkRetryLoading(false)
  }

  // 벌크 삭제 핸들러
  const handleBulkRetryDelete = async () => {
    const selectedCount = getSelectedCount()
    if (selectedCount === 0) {
      message.warning('삭제 재시도할 작업을 선택해주세요.')
      return
    }

    try {
      const request = {
        mode: selection.mode,
        filters: getCurrentFilters(),
        includeIds: selection.mode === SelectionMode.PAGE ? Array.from(selection.includeIds) : undefined,
        excludeIds: selection.mode === SelectionMode.ALL ? Array.from(selection.excludedIds) : undefined,
      }

      const response = await bulkRetryDeleteJobs(request)
      message.success(response.message)

      // 선택 상태 초기화
      setSelection({
        mode: SelectionMode.PAGE,
        includeIds: new Set(),
        excludedIds: new Set(),
      })
      fetchJobs()
    } catch (error: any) {
      message.error(error.message || '벌크 삭제 재시도에 실패했습니다.')
    }
  }

  const handleBulkDelete = async () => {
    const selectedCount = getSelectedCount()
    if (selectedCount === 0) {
      message.warning('삭제할 작업을 선택해주세요.')
      return
    }

    setBulkDeleteLoading(true)
    try {
      const request: BulkActionRequest = {
        mode: selection.mode,
        filters: getCurrentFilters(),
        includeIds: selection.mode === SelectionMode.PAGE ? Array.from(selection.includeIds) : undefined,
        excludeIds: selection.mode === SelectionMode.ALL ? Array.from(selection.excludedIds) : undefined,
        action: BulkActionType.DELETE,
      }

      const response = await deleteJobs(request)
      message.success(response.message)

      // 선택 상태 초기화
      setSelection({
        mode: SelectionMode.PAGE,
        includeIds: new Set(),
        excludedIds: new Set(),
      })
      fetchJobs()
    } catch (error: any) {
      message.error(error.message || '벌크 삭제에 실패했습니다.')
    }
    setBulkDeleteLoading(false)
  }

  // 툴바: 선택된 작업에 등록후자동삭제(분) 일괄 적용
  const handleBulkSetAutoDeleteMinutes = async () => {
    const selectedCount = getSelectedCount()
    if (selectedCount === 0) {
      message.warning('적용할 작업을 선택해주세요.')
      return
    }
    const m = Number(autoDeleteMinutes)
    if (Number.isNaN(m) || m < 0) {
      message.warning('분은 0 이상의 정수로 입력해주세요.')
      return
    }

    setAutoDeleteApplyLoading(true)
    try {
      const request: BulkActionRequest = {
        mode: selection.mode,
        filters: getCurrentFilters(),
        includeIds: selection.mode === SelectionMode.PAGE ? Array.from(selection.includeIds) : undefined,
        excludeIds: selection.mode === SelectionMode.ALL ? Array.from(selection.excludedIds) : undefined,
        action: BulkActionType.AUTO_DELETE,
        autoDeleteMinutes: m,
      }

      const response = await bulkUpdateAutoDelete(request)
      message.success(response.message)

      // 선택 상태 초기화
      setSelection({
        mode: SelectionMode.PAGE,
        includeIds: new Set(),
        excludedIds: new Set(),
      })
      fetchJobs()
    } catch (error: any) {
      message.error(error.message || '등록후자동삭제(분) 적용 실패')
    }
    setAutoDeleteApplyLoading(false)
  }

  // 개별 작업의 등록후자동삭제(분) 변경
  const handleAutoDeleteMinutesChange = async (job: PostJob, minutes: number | null) => {
    try {
      const m = Number(minutes)
      if (Number.isNaN(m) || m < 0) {
        message.warning('분은 0 이상의 정수로 입력해주세요.')
        return
      }
      if (m === 0) {
        // autoDeleteMinutes 제거
        await updateJobAutoDeleteMinutes(job.id, null, null)
        message.success('자동삭제 설정이 제거되었습니다')
      } else {
        // autoDeleteMinutes 설정
        await updateJobAutoDeleteMinutes(job.id, m)

        // 완료된 작업이면 즉시 deleteAt 계산하여 적용 (현재시간 기준)
        if (job.status === JOB_STATUS.COMPLETED) {
          const now = dayjs()
          const deleteAt = now.add(m, 'minute').toISOString()
          await updateJobAutoDeleteMinutes(job.id, m, deleteAt)
        }
        message.success('등록후자동삭제(분) 설정이 적용되었습니다')
      }
      fetchJobs()
    } catch {
      message.error('등록후자동삭제(분) 설정 실패')
    }
  }

  // 툴바: 선택된 작업의 자동삭제 설정 제거
  const handleBulkRemoveAutoDelete = async () => {
    const selectedCount = getSelectedCount()
    if (selectedCount === 0) {
      message.warning('적용할 작업을 선택해주세요.')
      return
    }

    setAutoDeleteRemoveLoading(true)
    try {
      const request: BulkActionRequest = {
        mode: selection.mode,
        filters: getCurrentFilters(),
        includeIds: selection.mode === SelectionMode.PAGE ? Array.from(selection.includeIds) : undefined,
        excludeIds: selection.mode === SelectionMode.ALL ? Array.from(selection.excludedIds) : undefined,
        action: BulkActionType.AUTO_DELETE,
        autoDeleteMinutes: null, // null로 설정하여 자동삭제 제거
      }

      const response = await bulkUpdateAutoDelete(request)
      message.success(response.message)

      // 선택 상태 초기화
      setSelection({
        mode: SelectionMode.PAGE,
        includeIds: new Set(),
        excludedIds: new Set(),
      })
      fetchJobs()
    } catch (error: any) {
      message.error(error.message || '자동삭제 설정 제거 실패')
    }
    setAutoDeleteRemoveLoading(false)
  }

  const handleApplyInterval = async () => {
    const selectedCount = getSelectedCount()
    if (selectedCount === 0) {
      message.warning('간격을 적용할 작업을 선택해주세요.')
      return
    }
    if (intervalStart > intervalEnd) {
      const unitLabel = intervalUnit === 'min' ? '분' : '초'
      message.warning(`시작 ${unitLabel}가 끝 ${unitLabel}보다 클 수 없습니다.`)
      return
    }
    setIntervalApplyLoading(true)
    try {
      const startInSeconds = intervalUnit === 'min' ? intervalStart * 60 : intervalStart
      const endInSeconds = intervalUnit === 'min' ? intervalEnd * 60 : intervalEnd
      const request: BulkActionRequest = {
        mode: selection.mode,
        filters: getCurrentFilters(),
        includeIds: selection.mode === SelectionMode.PAGE ? Array.from(selection.includeIds) : undefined,
        excludeIds: selection.mode === SelectionMode.ALL ? Array.from(selection.excludedIds) : undefined,
        action: BulkActionType.APPLY_INTERVAL,
        intervalStart: startInSeconds,
        intervalEnd: endInSeconds,
      }

      const response = await bulkApplyInterval(request)
      message.success(response.message)

      // 선택 상태 초기화
      setSelection({
        mode: SelectionMode.PAGE,
        includeIds: new Set(),
        excludedIds: new Set(),
      })
      fetchJobs()
    } catch (error: any) {
      message.error(error.message || '간격 적용 실패')
    }
    setIntervalApplyLoading(false)
  }

  const handleBulkPendingToRequest = async () => {
    const selectedCount = getSelectedCount()
    if (selectedCount === 0) {
      message.warning('등록요청으로 변경할 작업을 선택해주세요.')
      return
    }
    try {
      const request: BulkActionRequest = {
        mode: selection.mode,
        filters: getCurrentFilters(),
        includeIds: selection.mode === SelectionMode.PAGE ? Array.from(selection.includeIds) : undefined,
        excludeIds: selection.mode === SelectionMode.ALL ? Array.from(selection.excludedIds) : undefined,
        action: BulkActionType.PENDING_TO_REQUEST,
      }

      const response = await bulkPendingToRequest(request)
      message.success(response.message)

      // 선택 상태 초기화
      setSelection({
        mode: SelectionMode.PAGE,
        includeIds: new Set(),
        excludedIds: new Set(),
      })
      fetchJobs()
    } catch (error: any) {
      message.error(error.message || '상태 일괄변경 실패')
    }
  }

  const handleStatusChange = async (job: PostJob, value: JobStatus) => {
    if (value === job.status) return
    if (job.status === JOB_STATUS.PENDING && value === JOB_STATUS.REQUEST) {
      await pendingToRequest(job.id)
    }
    setEditingStatusJobId(null)
    fetchJobs()
  }

  const handleScheduledAtChange = async (job: PostJob, date: dayjs.Dayjs | null) => {
    try {
      const scheduledAt = date ? date.toISOString() : null
      await updateJobScheduledAt(job.id, scheduledAt)
      message.success(scheduledAt ? '예약시간이 변경되었습니다' : '예약시간이 해제되었습니다')
      fetchJobs()
    } catch (error: any) {
      message.error(error?.message || '예약시간 변경 실패')
    }
  }

  // 툴바: 선택된 작업의 조회수 가져오기
  const handleUpdateViewCounts = async () => {
    const selectedCount = getSelectedCount()
    if (selectedCount === 0) {
      message.warning('조회수를 가져올 작업을 선택해주세요.')
      return
    }

    setViewCountUpdateLoading(true)
    try {
      // 선택된 작업 ID 목록 생성
      let jobIds: string[] = []
      if (selection.mode === SelectionMode.PAGE) {
        jobIds = Array.from(selection.includeIds)
      } else {
        // ALL 모드일 경우, 제외된 것을 제외한 전체 목록
        jobIds = data.filter(job => !selection.excludedIds.has(job.id)).map(job => job.id)
      }

      // 완료된 작업만 필터링 (resultUrl이 있는 작업만)
      const validJobs = data.filter(job => jobIds.includes(job.id) && job.postJob?.resultUrl)
      const validJobIds = validJobs.map(job => job.id)

      if (validJobIds.length === 0) {
        message.warning('조회수를 가져올 수 있는 작업이 없습니다. (완료된 작업만 가능)')
        setViewCountUpdateLoading(false)
        return
      }

      const response = await updateViewCounts(validJobIds)
      if (response.success) {
        message.success(`조회수 업데이트 완료: 성공 ${response.updated}개, 실패 ${response.failed}개`)
        fetchJobs()
      }

      // 선택 상태 초기화
      setSelection({
        mode: SelectionMode.PAGE,
        includeIds: new Set(),
        excludedIds: new Set(),
      })
    } catch (error: any) {
      message.error(error?.message || '조회수 업데이트 실패')
    }
    setViewCountUpdateLoading(false)
  }

  // 툴바: 선택된 작업을 엑셀로 다운로드
  const handleExcelDownload = async () => {
    const selectedCount = getSelectedCount()
    if (selectedCount === 0) {
      message.warning('다운로드할 작업을 선택해주세요.')
      return
    }

    setExcelDownloadLoading(true)
    try {
      // 선택된 작업 ID 목록 생성
      let jobIds: string[] = []
      if (selection.mode === SelectionMode.PAGE) {
        jobIds = Array.from(selection.includeIds)
      } else {
        // ALL 모드일 경우, 제외된 것을 제외한 전체 목록
        jobIds = data.filter(job => !selection.excludedIds.has(job.id)).map(job => job.id)
      }

      // 포스팅 작업만 필터링
      const postJobIds = data.filter(job => jobIds.includes(job.id) && job.type === JOB_TYPE.POST).map(job => job.id)

      if (postJobIds.length === 0) {
        message.warning('다운로드할 수 있는 포스팅 작업이 없습니다.')
        setExcelDownloadLoading(false)
        return
      }

      const blob = await exportJobsToExcel(postJobIds)

      // Blob을 다운로드
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `포스팅목록_${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)

      message.success(`${postJobIds.length}개 작업을 엑셀로 다운로드했습니다.`)
    } catch (error: any) {
      message.error(error?.message || '엑셀 다운로드 실패')
    }
    setExcelDownloadLoading(false)
  }

  return (
    <div>
      {/* 필터 영역 (상태/타입/검색 등) */}
      <div style={{ marginBottom: 12 }}>
        <Space size="middle" wrap>
          <Space>
            <span>상태 필터:</span>
            <Select
              value={statusFilter}
              onChange={value => setStatusFilter(value as JobStatus)}
              options={JOB_STATUS_OPTIONS}
              style={{ width: 120 }}
            />
          </Space>
          <Space>
            <span>타입 필터:</span>
            <Select
              value={typeFilter}
              onChange={value => setTypeFilter(value as JobType)}
              options={JOB_TYPE_OPTIONS}
              style={{ width: 120 }}
            />
          </Space>
          <Space>
            <span>검색:</span>
            <Input.Search
              placeholder="제목, 내용, 결과 검색"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onSearch={fetchJobs}
              style={{ width: 300 }}
              allowClear
            />
          </Space>
        </Space>
      </div>

      {/* 선택 툴바: 선택된 작업이 있을 때만, 필터 아래에 배경색/라운드/패딩 적용 */}
      {getSelectedCount() > 0 && (
        <div
          style={{
            background: '#f9f9f9',
            borderRadius: 8,
            padding: '14px 20px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontWeight: 500 }}>
            {selection.mode === SelectionMode.ALL ? (
              <>
                전체 {totalCount - selection.excludedIds.size}개 작업이 선택되었습니다.
                {selection.excludedIds.size > 0 && (
                  <span style={{ fontSize: '12px', color: '#ff4d4f', marginLeft: '8px' }}>
                    ({selection.excludedIds.size}개 제외됨)
                  </span>
                )}
                <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>(필터 조건에 맞는 모든 작업)</span>
              </>
            ) : (
              <>
                {selection.includeIds.size}개 작업이 선택되었습니다.
                {totalCount > 0 && (
                  <span style={{ fontSize: '12px', color: '#666', marginLeft: '8px' }}>(전체 {totalCount}개 중)</span>
                )}
              </>
            )}
          </span>
          <Button type="primary" onClick={handleBulkRetry} loading={bulkRetryLoading}>
            실패한 작업 재시도
            {selection.mode === SelectionMode.ALL ? (
              <span style={{ fontSize: '12px', marginLeft: '4px' }}>
                {selection.excludedIds.size > 0 ? `(${getSelectedCount()}개)` : '(전체)'}
              </span>
            ) : (
              <span style={{ fontSize: '12px', marginLeft: '4px' }}>
                ({data.filter(job => selection.includeIds.has(job.id) && job.status === JOB_STATUS.FAILED).length}개)
              </span>
            )}
          </Button>
          <Button
            type="primary"
            onClick={handleBulkRetryDelete}
            style={{ backgroundColor: '#722ed1', borderColor: '#722ed1' }}
          >
            삭제실패 재시도
            {selection.mode === SelectionMode.ALL ? (
              <span style={{ fontSize: '12px', marginLeft: '4px' }}>
                {selection.excludedIds.size > 0 ? `(${getSelectedCount()}개)` : '(전체)'}
              </span>
            ) : (
              <span style={{ fontSize: '12px', marginLeft: '4px' }}>
                (
                {data.filter(job => selection.includeIds.has(job.id) && job.status === JOB_STATUS.DELETE_FAILED).length}
                개)
              </span>
            )}
          </Button>
          <Button danger onClick={handleBulkDelete} loading={bulkDeleteLoading}>
            선택된 작업 삭제
            {selection.mode === SelectionMode.ALL ? (
              <span style={{ fontSize: '12px', marginLeft: '4px' }}>
                {selection.excludedIds.size > 0 ? `(${getSelectedCount()}개)` : '(전체)'}
              </span>
            ) : (
              <span style={{ fontSize: '12px', marginLeft: '4px' }}>({selection.includeIds.size}개)</span>
            )}
          </Button>
          <Divider />
          <span>등록 간격</span>
          <Select
            size="small"
            value={intervalUnit}
            onChange={val => setIntervalUnit(val as 'sec' | 'min')}
            style={{ width: 80 }}
            options={[
              { label: '분', value: 'min' },
              { label: '초', value: 'sec' },
            ]}
          />
          <InputNumber
            min={1}
            max={intervalUnit === 'min' ? 1440 : 86400}
            value={intervalStart}
            onChange={v => setIntervalStart(Number(v))}
          />
          <span>~</span>
          <InputNumber
            min={1}
            max={intervalUnit === 'min' ? 1440 : 86400}
            value={intervalEnd}
            onChange={v => setIntervalEnd(Number(v))}
          />
          <Button
            type="primary"
            loading={intervalApplyLoading}
            onClick={handleApplyInterval}
            disabled={getSelectedCount() === 0}
          >
            간격 적용
            {selection.mode === SelectionMode.ALL ? (
              <span style={{ fontSize: '12px', marginLeft: '4px' }}>
                {selection.excludedIds.size > 0 ? `(${getSelectedCount()}개)` : '(전체)'}
              </span>
            ) : (
              <span style={{ fontSize: '12px', marginLeft: '4px' }}>
                ({data.filter(job => selection.includeIds.has(job.id) && job.status === JOB_STATUS.PENDING).length}개)
              </span>
            )}
          </Button>
          <Button onClick={handleBulkPendingToRequest} disabled={getSelectedCount() === 0}>
            등록요청 일괄변경
            {selection.mode === SelectionMode.ALL ? (
              <span style={{ fontSize: '12px', marginLeft: '4px' }}>
                {selection.excludedIds.size > 0 ? `(${getSelectedCount()}개)` : '(전체)'}
              </span>
            ) : (
              <span style={{ fontSize: '12px', marginLeft: '4px' }}>
                ({data.filter(job => selection.includeIds.has(job.id) && job.status === JOB_STATUS.PENDING).length}개)
              </span>
            )}
          </Button>
          <Divider type="vertical" />
          <span>등록후자동삭제(분):</span>
          <InputNumber
            min={0}
            placeholder="분"
            value={autoDeleteMinutes as any}
            onChange={v => setAutoDeleteMinutes((v as number) || null)}
            style={{ width: 110 }}
          />
          <Button loading={autoDeleteApplyLoading} onClick={handleBulkSetAutoDeleteMinutes}>
            자동삭제 적용
            {selection.mode === SelectionMode.ALL ? (
              <span style={{ fontSize: '12px', marginLeft: '4px' }}>
                {selection.excludedIds.size > 0 ? `(${getSelectedCount()}개)` : '(전체)'}
              </span>
            ) : (
              <span style={{ fontSize: '12px', marginLeft: '4px' }}>
                (
                {
                  data.filter(
                    job =>
                      selection.includeIds.has(job.id) &&
                      job.type === JOB_TYPE.POST &&
                      !(job as PostJob).postJob?.deletedAt,
                  ).length
                }
                개)
              </span>
            )}
          </Button>
          <Button danger loading={autoDeleteRemoveLoading} onClick={handleBulkRemoveAutoDelete}>
            자동삭제 제거
            {selection.mode === SelectionMode.ALL ? (
              <span style={{ fontSize: '12px', marginLeft: '4px' }}>
                {selection.excludedIds.size > 0 ? `(${getSelectedCount()}개)` : '(전체)'}
              </span>
            ) : (
              <span style={{ fontSize: '12px', marginLeft: '4px' }}>
                (
                {
                  data.filter(
                    job =>
                      selection.includeIds.has(job.id) &&
                      job.type === JOB_TYPE.POST &&
                      !(job as PostJob).postJob?.deletedAt,
                  ).length
                }
                개)
              </span>
            )}
          </Button>
          <Divider type="vertical" />
          <Button
            type="primary"
            loading={viewCountUpdateLoading}
            onClick={handleUpdateViewCounts}
            style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
          >
            조회수 가져오기
            {selection.mode === SelectionMode.ALL ? (
              <span style={{ fontSize: '12px', marginLeft: '4px' }}>
                {selection.excludedIds.size > 0 ? `(${getSelectedCount()}개)` : '(전체)'}
              </span>
            ) : (
              <span style={{ fontSize: '12px', marginLeft: '4px' }}>
                (
                {
                  data.filter(
                    job =>
                      selection.includeIds.has(job.id) &&
                      job.type === JOB_TYPE.POST &&
                      job.status === JOB_STATUS.COMPLETED &&
                      (job as PostJob).postJob?.resultUrl,
                  ).length
                }
                개)
              </span>
            )}
          </Button>
          <Button
            type="primary"
            loading={excelDownloadLoading}
            onClick={handleExcelDownload}
            style={{ backgroundColor: '#1890ff', borderColor: '#1890ff' }}
          >
            엑셀 다운로드
            {selection.mode === SelectionMode.ALL ? (
              <span style={{ fontSize: '12px', marginLeft: '4px' }}>
                {selection.excludedIds.size > 0 ? `(${getSelectedCount()}개)` : '(전체)'}
              </span>
            ) : (
              <span style={{ fontSize: '12px', marginLeft: '4px' }}>
                ({data.filter(job => selection.includeIds.has(job.id) && job.type === JOB_TYPE.POST).length}개)
              </span>
            )}
          </Button>
        </div>
      )}

      <Table
        rowKey="id"
        dataSource={data}
        loading={loading}
        pagination={{
          current: currentPage,
          pageSize,
          total: totalCount,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} / 총 ${total}개`,
          pageSizeOptions: ['10', '20', '50', '100'],
          onChange: (page, size) => {
            setCurrentPage(page)
            setPageSize(size || 20)
          },
        }}
        onChange={handleTableChange}
        size="middle"
        bordered
        style={{ background: '#fff' }}
        scroll={{ x: 'max-content' }}
        rowClassName={(record: PostJob) => `row-${record.status}`}
        columns={[
          {
            title: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <Checkbox
                  checked={selection.mode === SelectionMode.ALL}
                  indeterminate={selection.mode === SelectionMode.PAGE && selection.includeIds.size > 0}
                  onChange={e => handleSelectAllPages(e.target.checked)}
                  title="필터 조건에 맞는 모든 작업 선택"
                >
                  <span style={{ fontSize: '11px', color: '#666' }}>전체</span>
                </Checkbox>
                <Checkbox
                  checked={selection.mode === SelectionMode.PAGE && selection.includeIds.size === data.length}
                  indeterminate={
                    selection.mode === SelectionMode.PAGE &&
                    selection.includeIds.size > 0 &&
                    selection.includeIds.size < data.length
                  }
                  onChange={e => handleSelectAll(e.target.checked)}
                  title="현재 페이지의 모든 작업 선택"
                >
                  <span style={{ fontSize: '11px', color: '#666' }}>현재페이지</span>
                </Checkbox>
              </div>
            ),
            dataIndex: 'checkbox',
            width: 100,
            align: 'center',
            render: (_: any, record: PostJob) => (
              <Checkbox checked={isChecked(record.id)} onChange={e => handleSelectJob(record.id, e.target.checked)} />
            ),
          },
          {
            title: '갤러리',
            dataIndex: 'galleryUrl',
            width: 120,
            sorter: true,
            align: 'center',
            render: (url: string, row: PostJob) => (
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  background: '#f5f5f5',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                {extractGalleryId(row.postJob?.galleryUrl || '')}
              </span>
            ),
          },
          {
            title: '결과',
            dataIndex: 'resultMsg',
            width: 350,
            render: (v: string, row: PostJob) => {
              const resultUrl = row.postJob?.resultUrl || row.resultUrl
              const latestLog = latestLogs[row.id]
              const displayMessage = latestLog ? latestLog.message : v || getDefaultMessage(row.status)
              const statusType = getStatusType(row.status)

              const popoverContent = (
                <PopoverContent>
                  <div className={`popover-header ${statusType}`}>
                    {getStatusIcon(row.status)} {getStatusTitle(row.status)}
                  </div>
                  <div className={`popover-message ${statusType}`}>{displayMessage}</div>
                  {latestLog && (
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
                      최신 로그: {new Date(latestLog.createdAt).toLocaleString('ko-KR')}
                    </div>
                  )}
                  {row.status === JOB_STATUS.COMPLETED && resultUrl && (
                    <div className="result-url">
                      <a
                        href={resultUrl}
                        onClick={e => {
                          e.preventDefault()
                          window.electronAPI?.openExternal(resultUrl)
                        }}
                        style={{
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        등록된 글 보기 →
                      </a>
                    </div>
                  )}
                </PopoverContent>
              )

              return (
                <Popover
                  content={popoverContent}
                  title={null}
                  trigger="hover"
                  placement="topLeft"
                  mouseEnterDelay={0.3}
                >
                  <ResultCell>
                    <div className={`result-text hover-hint ${statusType}-text`}>{displayMessage}</div>
                    {row.status === JOB_STATUS.COMPLETED && resultUrl && (
                      <a
                        href={resultUrl}
                        onClick={e => {
                          e.preventDefault()
                          window.electronAPI?.openExternal(resultUrl)
                        }}
                        style={{ color: '#1890ff', fontSize: '12px' }}
                      >
                        등록된 글 보기 →
                      </a>
                    )}
                  </ResultCell>
                </Popover>
              )
            },
            sorter: true,
          },
          {
            title: '제목',
            dataIndex: 'subject',
            width: 300,
            sorter: true,
            ellipsis: { showTitle: false },
            render: (text: string, row: PostJob) => {
              const resultUrl = row.postJob?.resultUrl || row.resultUrl
              const title = row.postJob?.title || '-'

              return (
                <span title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  {title}
                  {resultUrl && (
                    <a
                      href={resultUrl}
                      onClick={e => {
                        e.preventDefault()
                        window.electronAPI?.openExternal(resultUrl)
                      }}
                      style={{
                        color: '#1890ff',
                        fontSize: '12px',
                        marginLeft: 4,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px',
                      }}
                    >
                      등록된 글 보기 <LinkOutlined style={{ fontSize: '12px', opacity: 0.7 }} />
                    </a>
                  )}
                </span>
              )
            },
          },
          {
            title: '말머리',
            dataIndex: 'headtext',
            width: 100,
            sorter: true,
            align: 'center',
            render: (text: string, row: PostJob) => {
              return row.postJob?.headtext ? (
                <Tag color="blue" style={{ fontSize: '11px' }}>
                  {row.postJob.headtext}
                </Tag>
              ) : (
                '-'
              )
            },
          },
          {
            title: '조회수',
            dataIndex: ['postJob', 'viewCount'],
            width: 100,
            sorter: true,
            align: 'center',
            render: (viewCount: number | undefined, row: PostJob) => {
              if (viewCount !== undefined && viewCount !== null) {
                return (
                  <div>
                    <div style={{ fontWeight: 500 }}>{viewCount.toLocaleString()}</div>
                    {row.postJob?.viewCountUpdatedAt && (
                      <div style={{ fontSize: '10px', color: '#999', marginTop: '2px' }}>
                        {dayjs(row.postJob.viewCountUpdatedAt).format('MM/DD HH:mm')}
                      </div>
                    )}
                  </div>
                )
              }
              return '-'
            },
          },
          {
            title: '상태',
            dataIndex: 'status',
            key: 'status',
            render: (value: JobStatus, record: PostJob) =>
              editingStatusJobId === record.id ? (
                <Select
                  size="small"
                  value={value}
                  style={{ minWidth: 100 }}
                  onChange={val => handleStatusChange(record, val)}
                  onBlur={() => setEditingStatusJobId(null)}
                  options={[
                    ...(record.status === JOB_STATUS.PENDING
                      ? [
                          { value: JOB_STATUS.PENDING, label: JOB_STATUS_LABEL[JOB_STATUS.PENDING] },
                          { value: JOB_STATUS.REQUEST, label: JOB_STATUS_LABEL[JOB_STATUS.REQUEST] },
                        ]
                      : []),
                    ...(record.status === JOB_STATUS.REQUEST
                      ? [
                          { value: JOB_STATUS.REQUEST, label: JOB_STATUS_LABEL[JOB_STATUS.REQUEST] },
                          { value: JOB_STATUS.PENDING, label: JOB_STATUS_LABEL[JOB_STATUS.PENDING] },
                        ]
                      : []),
                  ]}
                  autoFocus
                />
              ) : (
                <Tag
                  color={JOB_STATUS_COLOR[value]}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setEditingStatusJobId(record.id)}
                >
                  {JOB_STATUS_LABEL[value]}
                </Tag>
              ),
          },
          {
            title: '예약시간',
            dataIndex: 'scheduledAt',
            key: 'scheduledAt',
            width: 200,
            align: 'center',
            render: (value: string, record: PostJob) => (
              <DatePicker
                showTime={{ format: 'HH:mm:ss' }}
                format="YYYY-MM-DD HH:mm:ss"
                value={value ? dayjs(value) : null}
                onChange={date => handleScheduledAtChange(record, date)}
                style={{ width: 180 }}
                placeholder="예약시간 선택"
                allowClear
              />
            ),
            sorter: true,
          },
          {
            title: '등록후자동삭제(분)',
            dataIndex: 'autoDeleteMinutes',
            key: 'autoDeleteMinutes',
            width: 150,
            align: 'center',
            render: (_: any, record: PostJob) => {
              // 이미 삭제된 작업만 수정 불가
              if (record.postJob?.deletedAt) {
                return '-'
              }
              return (
                <InputNumber
                  min={0}
                  placeholder="분"
                  value={record.postJob?.autoDeleteMinutes || undefined}
                  onChange={v => handleAutoDeleteMinutesChange(record, v as number)}
                  style={{ width: 110 }}
                />
              )
            },
          },
          {
            title: '삭제예정',
            dataIndex: ['postJob', 'deleteAt'],
            key: 'deleteAt',
            width: 170,
            align: 'center',
            render: (value: string, record: PostJob) => {
              return record.postJob?.deleteAt ? dayjs(record.postJob.deleteAt).format('YYYY-MM-DD HH:mm') : '-'
            },
            sorter: true,
          },
          {
            title: '삭제시간',
            dataIndex: ['postJob', 'deletedAt'],
            key: 'deletedAt',
            width: 170,
            align: 'center',
            render: (value: string, record: PostJob) => {
              return record.postJob?.deletedAt ? dayjs(record.postJob.deletedAt).format('YYYY-MM-DD HH:mm') : '-'
            },
            sorter: true,
          },
          {
            title: '시작시간',
            dataIndex: 'startedAt',
            key: 'startedAt',
            width: 170,
            align: 'center',
            render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
            sorter: true,
          },
          {
            title: '완료시간',
            dataIndex: 'completedAt',
            key: 'completedAt',
            width: 170,
            align: 'center',
            render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
            sorter: true,
          },
          {
            title: '생성시간',
            dataIndex: 'createdAt',
            key: 'createdAt',
            width: 170,
            align: 'center',
            render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '-'),
            sorter: true,
          },
          {
            title: '액션',
            dataIndex: 'action',
            width: 150,
            fixed: 'right',
            align: 'center',
            render: (_: any, row: PostJob) => (
              <Space size="small" direction="vertical">
                <Space size="small">
                  <Button size="small" onClick={() => showJobLogs(row.id)} style={{ fontSize: '11px' }}>
                    상세
                  </Button>
                  {row.status === JOB_STATUS.FAILED && (
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => handleRetry(row.id)}
                      style={{ fontSize: '11px' }}
                    >
                      재시도
                    </Button>
                  )}
                  {row.status === JOB_STATUS.DELETE_FAILED && row.type === JOB_TYPE.POST && (
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => handleRetryDelete(row.id)}
                      style={{ fontSize: '11px' }}
                    >
                      삭제재시도
                    </Button>
                  )}
                </Space>
                {row.status !== JOB_STATUS.PROCESSING && (
                  <Popconfirm
                    title="정말 삭제하시겠습니까?"
                    onConfirm={() => handleDelete(row.id)}
                    okText="삭제"
                    cancelText="취소"
                  >
                    <Button danger size="small" style={{ fontSize: '11px', width: '100%' }}>
                      삭제
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]}
      />

      {/* JobLog 모달 */}
      <Modal
        title={`작업 로그 (ID: ${currentJobId})`}
        open={logModalVisible}
        onCancel={() => setLogModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setLogModalVisible(false)}>
            닫기
          </Button>,
        ]}
        width={800}
      >
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {logsLoading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>로그를 불러오는 중...</div>
          ) : jobLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>로그가 없습니다.</div>
          ) : (
            <div>
              {jobLogs.map((log, index) => (
                <div
                  key={log.id}
                  style={{
                    padding: '8px 12px',
                    borderBottom: index === jobLogs.length - 1 ? 'none' : '1px solid #f0f0f0',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ color: '#666', fontSize: '11px', marginBottom: '4px' }}>
                    {new Date(log.createdAt).toLocaleString('ko-KR')}
                  </div>
                  <div style={{ color: '#333' }}>{log.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default PostingJobTable
