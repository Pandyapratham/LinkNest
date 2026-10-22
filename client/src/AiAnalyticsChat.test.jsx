import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AiAnalyticsChat from './AiAnalyticsChat'
import { api } from './api'

vi.mock('./api', () => ({ api: { analyticsChat: vi.fn() } }))

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe('AI analytics chat widget', () => {
  it('opens a polished assistant with analytics prompts and sends a grounded follow-up', async () => {
    const user = userEvent.setup()
    api.analyticsChat.mockResolvedValue({ success: true, reply: 'Your portfolio link has 12 clicks in this period.' })
    render(<AiAnalyticsChat />)

    await user.click(screen.getByRole('button', { name: 'Open AI analytics assistant' }))
    expect(screen.getByText('Pinpoint AI')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /Top-performing links/ }))

    expect(await screen.findByText('Your portfolio link has 12 clicks in this period.')).toBeTruthy()
    expect(api.analyticsChat).toHaveBeenCalledWith({
      range: '7d',
      messages: [{ role: 'user', content: 'Which of my links perform best, and what does the data show?' }],
    })
  })

  it('supports follow-up context and the selected analytics period', async () => {
    const user = userEvent.setup()
    api.analyticsChat
      .mockResolvedValueOnce({ success: true, reply: 'Your most clicked link is Portfolio.' })
      .mockResolvedValueOnce({ success: true, reply: 'Over 30 days, the data shows your total click activity.' })
    render(<AiAnalyticsChat />)

    await user.click(screen.getByRole('button', { name: 'Open AI analytics assistant' }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Analytics period' }), '30d')
    await user.type(screen.getByRole('textbox', { name: 'Message the analytics assistant' }), 'Summarize my activity')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(api.analyticsChat).toHaveBeenCalledTimes(1))
    expect(api.analyticsChat).toHaveBeenLastCalledWith({
      range: '30d',
      messages: [{ role: 'user', content: 'Summarize my activity' }],
    })
    expect(await screen.findByText('Over 30 days, the data shows your total click activity.')).toBeTruthy()
  })
})
