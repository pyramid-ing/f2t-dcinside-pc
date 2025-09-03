import { StyleProvider } from '@ant-design/cssinjs'
import { ConfigProvider } from 'antd'
import koKR from 'antd/locale/ko_KR'
import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter as Router } from 'react-router-dom'
import { RecoilRoot } from 'recoil'
import App from './pages/app'
import SettingsInitializer from './components/SettingsInitializer'
import PermissionsInitializer from './components/PermissionsInitializer'
import './styles/global.css'

const container = document.getElementById('root') as HTMLElement
const root = createRoot(container)
root.render(
  <StyleProvider hashPriority="high">
    <ConfigProvider
      locale={koKR}
      form={{
        validateMessages: {
          default: '입력값을 확인해주세요',
          required: '${label}은(는) 필수 항목입니다',
          enum: '${label}은(는) [${enum}] 중 하나여야 합니다',
          whitespace: '${label}은(는) 공백일 수 없습니다',
          date: {
            format: '${label}의 날짜 형식이 올바르지 않습니다',
            parse: '${label}을(를) 날짜로 해석할 수 없습니다',
            invalid: '${label}은(는) 유효한 날짜가 아닙니다',
          },
          types: {
            string: '${label}은(는) 문자열이어야 합니다',
            method: '${label}은(는) 함수여야 합니다',
            array: '${label}은(는) 배열이어야 합니다',
            object: '${label}은(는) 객체여야 합니다',
            number: '${label}은(는) 숫자여야 합니다',
            date: '${label}은(는) 날짜여야 합니다',
            boolean: '${label}은(는) 불리언이어야 합니다',
            integer: '${label}은(는) 정수여야 합니다',
            float: '${label}은(는) 실수여야 합니다',
            regexp: '${label}은(는) 정규식이어야 합니다',
            email: '${label}은(는) 유효한 이메일이 아닙니다',
            url: '${label}은(는) 유효한 URL이 아닙니다',
            hex: '${label}은(는) 16진수여야 합니다',
          },
          string: {
            len: '${label}은(는) 정확히 ${len}자여야 합니다',
            min: '${label}은(는) 최소 ${min}자 이상이어야 합니다',
            max: '${label}은(는) 최대 ${max}자 이하여야 합니다',
            range: '${label}은(는) ${min}자 이상 ${max}자 이하여야 합니다',
          },
          number: {
            len: '${label}의 길이는 ${len}이어야 합니다',
            min: '${label}은(는) 최소 ${min} 이상이어야 합니다',
            max: '${label}은(는) 최대 ${max} 이하여야 합니다',
            range: '${label}은(는) ${min} ~ ${max} 사이여야 합니다',
          },
          array: {
            len: '${label}은(는) 정확히 ${len}개여야 합니다',
            min: '${label}은(는) 최소 ${min}개 이상이어야 합니다',
            max: '${label}은(는) 최대 ${max}개 이하여야 합니다',
            range: '${label}은(는) ${min}개 이상 ${max}개 이하여야 합니다',
          },
          pattern: {
            mismatch: '${label} 형식이 올바르지 않습니다',
          },
        },
      }}
    >
      <RecoilRoot>
        <SettingsInitializer>
          <PermissionsInitializer>
            <Router>
              <App />
            </Router>
          </PermissionsInitializer>
        </SettingsInitializer>
      </RecoilRoot>
    </ConfigProvider>
  </StyleProvider>,
)
