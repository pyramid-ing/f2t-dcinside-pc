import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator'

export class WorkflowExportXlsxDto {
  @IsString()
  @IsNotEmpty()
  keyword: string

  @IsNumber()
  @IsOptional()
  limit?: number
}

// 워크플로우 엑셀 업로드(DM/팔로우) 요청 DTO (엑셀 외 추가 파라미터 필요시 확장)
export class WorkflowSendDmToDto {
  // 엑셀 업로드 외에 추가 파라미터가 필요하다면 여기에 정의
}
