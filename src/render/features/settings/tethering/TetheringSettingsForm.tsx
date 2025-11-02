import type { Settings } from '@render/types/settings'
import { TetheringChangeType } from '@main/app/modules/settings/settings.types'
import React, { useEffect, useState } from 'react'
import type { FormInstance } from 'antd'
import { Form, Input, Space, message, Button, Radio, Select, Switch } from 'antd'
import { CheckCircleTwoTone, CloseCircleTwoTone, ReloadOutlined } from '@ant-design/icons'
import { checkTetheringConnection, changeIp, getWifiNetworks } from '@render/api/settingsApi'
import { getSettings } from '@render/api'
import { usePermissions } from '@render/hooks/usePermissions'
import { Permission } from '@render/types/permissions'

type TetheringFormValues = {
  tethering?: NonNullable<Settings['tethering']>
}

interface Props {
  form?: FormInstance<any>
}

const TetheringSettingsForm: React.FC<Props> = ({ form: parentForm }) => {
  const [form] = parentForm ? [parentForm] : Form.useForm<TetheringFormValues>()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [changingIp, setChangingIp] = useState(false)
  const [status, setStatus] = useState<null | 'success' | 'error'>(null)
  const [checkResult, setCheckResult] = useState<null | {
    adbFound: boolean
    connected: boolean
    output: string
  }>(null)
  const [wifiNetworks, setWifiNetworks] = useState<string[]>([])
  const [loadingWifi, setLoadingWifi] = useState(false)
  const { canAccess } = usePermissions()
  const canUseTethering = canAccess(Permission.TETHERING)

  useEffect(() => {
    if (!parentForm) {
      ;(async () => {
        try {
          setLoading(true)
          const s = await getSettings()
          form.setFieldsValue({ tethering: s.tethering })
        } catch (e) {
          message.error('설정을 불러오지 못했습니다.')
        } finally {
          setLoading(false)
        }
      })()
    }
  }, [form])

  useEffect(() => {
    loadWifiNetworks()
  }, [])

  const loadWifiNetworks = async () => {
    if (!canUseTethering) return

    try {
      setLoadingWifi(true)
      const result = await getWifiNetworks()
      setWifiNetworks(result.networks || [])
    } catch (e: any) {
      console.error('와이파이 목록 로드 실패:', e)
    } finally {
      setLoadingWifi(false)
    }
  }

  return (
    <div>
      <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>테더링 설정</h3>
      {!canUseTethering && (
        <div style={{ color: '#ff4d4f', marginTop: -8, marginBottom: 12, fontSize: 12 }}>
          테더링 권한이 없습니다. 라이센스에 테더링 권한이 필요합니다.
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <Space>
          <Button
            disabled={!canUseTethering}
            onClick={async () => {
              try {
                setChecking(true)
                const res = await checkTetheringConnection()
                setCheckResult(res)
                if (!res.adbFound) {
                  setStatus('error')
                  message.error('adb를 찾을 수 없습니다. PATH 또는 경로를 확인하세요.')
                } else if (res.connected) {
                  setStatus('success')
                  message.success('안드로이드 장치가 연결되어 있습니다.')
                } else {
                  setStatus('error')
                  message.warning('adb는 동작하지만 연결된 장치를 찾지 못했습니다.')
                }
              } catch (e: any) {
                setStatus('error')
                message.error(e?.response?.data?.message || e?.message || '연결 확인 실패')
              } finally {
                setChecking(false)
              }
            }}
            loading={checking}
            icon={
              status === 'success' ? (
                <CheckCircleTwoTone twoToneColor="#52c41a" />
              ) : status === 'error' ? (
                <CloseCircleTwoTone twoToneColor="#ff4d4f" />
              ) : undefined
            }
          >
            ADB 연결 확인
          </Button>

          <Button
            type="primary"
            disabled={!canUseTethering || status !== 'success'}
            onClick={async () => {
              try {
                setChangingIp(true)
                const result = await changeIp()

                if (result.changed) {
                  message.success(`IP 변경 성공: ${result.previousIp} → ${result.newIp}`)
                } else {
                  message.warning(`IP 변경 시도했지만 변경되지 않았습니다. 현재 IP: ${result.newIp}`)
                }
              } catch (e: any) {
                message.error(e?.response?.data?.message || e?.message || 'IP 변경 실패')
              } finally {
                setChangingIp(false)
              }
            }}
            loading={changingIp}
            icon={<ReloadOutlined />}
          >
            IP 변경
          </Button>
        </Space>

        {checkResult && (
          <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', color: '#666', fontSize: 12 }}>
            {checkResult.adbFound && checkResult.connected ? checkResult.output : '실패'}
          </div>
        )}
      </div>

      <div style={{ marginTop: 16, padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
        <h4 style={{ marginBottom: 12, fontSize: 14, fontWeight: 600 }}>IP 변경 주기</h4>

        <Form.Item label="변경 주기 타입" name={['tethering', 'changeInterval', 'type']}>
          <Radio.Group disabled={!canUseTethering}>
            <Radio value={TetheringChangeType.TIME}>시간 기반</Radio>
            <Radio value={TetheringChangeType.COUNT}>포스팅 수 기반</Radio>
          </Radio.Group>
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.tethering?.changeInterval?.type !== currentValues.tethering?.changeInterval?.type
          }
        >
          {({ getFieldValue }) => {
            const changeType = getFieldValue(['tethering', 'changeInterval', 'type'])

            if (changeType === TetheringChangeType.TIME) {
              return (
                <Form.Item label="변경 간격 (분)" name={['tethering', 'changeInterval', 'timeMinutes']}>
                  <Input type="number" min={1} disabled={!canUseTethering} placeholder="30" />
                </Form.Item>
              )
            }

            if (changeType === TetheringChangeType.COUNT) {
              return (
                <Form.Item label="포스팅 수" name={['tethering', 'changeInterval', 'postCount']}>
                  <Input type="number" min={1} disabled={!canUseTethering} placeholder="5" />
                </Form.Item>
              )
            }

            return null
          }}
        </Form.Item>

        <div style={{ color: '#888', fontSize: 12, marginTop: 8 }}>
          • 시간 기반: 마지막 IP 변경 후 설정한 시간이 지나면 다음 포스팅 전에 IP 변경
          <br />• 포스팅 수 기반: 설정한 개수만큼 포스팅 후 다음 포스팅 전에 IP 변경
        </div>
      </div>

      <div style={{ marginTop: 16, padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>와이파이 자동 연결</h4>
          <Form.Item name={['tethering', 'wifi', 'enabled']} valuePropName="checked" style={{ margin: 0 }}>
            <Switch disabled={!canUseTethering} />
          </Form.Item>
        </div>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.tethering?.wifi?.enabled !== currentValues.tethering?.wifi?.enabled
          }
        >
          {({ getFieldValue }) => {
            const wifiEnabled = getFieldValue(['tethering', 'wifi', 'enabled'])
            return (
              <>
                <Form.Item label="와이파이 이름 (SSID)" name={['tethering', 'wifi', 'ssid']}>
                  <Select
                    disabled={!canUseTethering || !wifiEnabled}
                    placeholder="저장된 와이파이 선택"
                    loading={loadingWifi}
                    showSearch
                    allowClear
                    filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                    options={wifiNetworks.map(network => ({ label: network, value: network }))}
                  />
                </Form.Item>

                <Form.Item label="비밀번호" name={['tethering', 'wifi', 'password']}>
                  <Input.Password disabled={!canUseTethering || !wifiEnabled} placeholder="와이파이 비밀번호" />
                </Form.Item>
              </>
            )
          }}
        </Form.Item>

        <div style={{ color: '#888', fontSize: 12, marginTop: 8 }}>
          • 포스팅/댓글 작성 전에 설정된 와이파이에 자동 연결됩니다.
          <br />• IP 변경 시 와이파이 연결이 끊어질 수 있어 자동으로 재연결합니다.
        </div>
      </div>
    </div>
  )
}

export default TetheringSettingsForm
