import { IsNotEmpty } from 'class-validator'

export class DcinsideExcelUploadDto {
  @IsNotEmpty()
  file: any
}
