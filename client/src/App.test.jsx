import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App, { PublicProfilePage } from './App'
import { api } from './api'

vi.mock('./api', () => ({
  api: {
    me: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn(), getProfile: vi.fn(), createProfile: vi.fn(), updateProfile: vi.fn(),
    getLinks: vi.fn(), createLink: vi.fn(), updateLink: vi.fn(), deleteLink: vi.fn(), reorderLinks: vi.fn(), publicProfile: vi.fn(), getAnalytics: vi.fn(),
  },
  API_BASE_URL: 'http://localhost:5000',
}))

afterEach(() => { cleanup(); vi.clearAllMocks(); window.history.replaceState({}, '', '/') })

describe('Pinpoint application flows', () => {
  it('restores a cookie session and loads the persisted dashboard profile and links', async () => {
    api.me.mockResolvedValue({ user: { id: 'user-id', email: 'demo@example.com', username: 'demo' } })
    api.getProfile.mockResolvedValue({ profile: { id: 'profile-id', slug: 'demo-profile', displayName: 'Demo Creator', enabled: true, theme: 'soft' } })
    api.getLinks.mockResolvedValue({ links: [{ id: 'link-id', title: 'Portfolio', destinationUrl: 'https://example.com', displayOrder: 0, enabled: true }] })
    api.publicProfile.mockResolvedValue({ profile: { slug: 'demo-profile', links: [{ title: 'Portfolio', id: 'link-id' }] } })
    api.getAnalytics.mockResolvedValue({ totalClicks: 0, daily: [], topLinks: [], devices: [] })
    render(<App />)
    expect(await screen.findByText('Demo Creator')).toBeTruthy()
    expect((await screen.findAllByText('Portfolio')).length).toBeGreaterThanOrEqual(1)
    expect(api.getProfile).toHaveBeenCalledTimes(1)
    expect(api.getLinks).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark dashboard theme' }))
    expect(document.querySelector('.app-shell.dashboard-dark')).toBeTruthy()
    await waitFor(() => expect(window.localStorage.getItem('pinpoint-dashboard-theme')).toBe('dark'))
  })

  it('renders an API-backed public profile with redirect links and only provided public fields', async () => {
    api.publicProfile.mockResolvedValue({ profile: { slug: 'public-demo', displayName: 'Public Creator', bio: 'A public bio', theme: 'midnight', links: [{ id: 'public-link-id', title: 'My site', destinationUrl: 'https://example.com', enabled: true }] } })
    render(<PublicProfilePage slug="public-demo" />)
    expect(await screen.findByRole('heading', { name: 'Public Creator' })).toBeTruthy()
    const link = await screen.findByRole('link', { name: /My site/ })
    expect(link.getAttribute('href')).toContain('/api/redirect/public-demo/public-link-id')
    expect(screen.queryByText(/@/)).toBeNull()
    await waitFor(() => expect(api.publicProfile).toHaveBeenCalledWith('public-demo'))
  })

  it('renders selected public layouts and portfolio fallbacks from public profile data', async () => {
    api.publicProfile.mockResolvedValue({ profile: { slug: 'portfolio-demo', displayName: 'Portfolio Creator', layout: 'portfolio', theme: 'minimal', backgroundColor: '#ffffff', accentColor: '#7658df', fontFamily: 'serif', buttonStyle: 'pill', bio: '', links: [] } })
    render(<PublicProfilePage slug="portfolio-demo" />)
    expect(await screen.findByRole('heading', { name: 'Portfolio Creator' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'About me' })).toBeTruthy()
    expect(screen.getByText(/introduction will appear here/i)).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Projects & links' })).toBeTruthy()
    expect(document.querySelector('.public-card.layout-portfolio.button-pill.theme-minimal')).toBeTruthy()
  })

  it('shows a safe error state when a public slug is unavailable', async () => {
    api.publicProfile.mockRejectedValue(new Error('Profile not found'))
    render(<PublicProfilePage slug="missing" />)
    expect(await screen.findByText('Profile not found')).toBeTruthy()
  })

  it('submits the login form and restores the signed-in workspace', async () => {
    const user = userEvent.setup()
    api.me.mockRejectedValue(Object.assign(new Error('Authentication required'), { status: 401 }))
    api.login.mockResolvedValue({ user: { id: 'user-id', email: 'demo@example.com', username: 'demo' } })
    api.getProfile.mockRejectedValue(Object.assign(new Error('Profile not found'), { status: 404 }))
    render(<App />)
    await user.type(await screen.findByLabelText('Email or username'), 'demo@example.com')
    await user.type(screen.getByLabelText('Password'), 'long-enough-password')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByRole('heading', { name: /welcome, demo/i })).toBeTruthy()
    expect(api.login).toHaveBeenCalledWith({ identifier: 'demo@example.com', password: 'long-enough-password' })
  })

  it('submits a username through the same login identifier field', async () => {
    const user = userEvent.setup()
    api.me.mockRejectedValue(Object.assign(new Error('Authentication required'), { status: 401 }))
    api.login.mockResolvedValue({ user: { id: 'user-id', email: 'demo@example.com', username: 'demo' } })
    api.getProfile.mockRejectedValue(Object.assign(new Error('Profile not found'), { status: 404 }))
    render(<App />)
    await user.type(await screen.findByLabelText('Email or username'), 'demo')
    await user.type(screen.getByLabelText('Password'), 'long-enough-password')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByRole('heading', { name: /welcome, demo/i })).toBeTruthy()
    expect(api.login).toHaveBeenCalledWith({ identifier: 'demo', password: 'long-enough-password' })
  })

  it('creates links through the API using a normalized HTTPS destination', async () => {
    const user = userEvent.setup()
    api.me.mockResolvedValue({ user: { id: 'user-id', email: 'demo@example.com', username: 'demo' } })
    api.getProfile.mockResolvedValue({ profile: { id: 'profile-id', slug: 'demo-profile', displayName: 'Demo Creator', enabled: true } })
    api.getLinks.mockResolvedValue({ links: [] })
    api.publicProfile.mockResolvedValue({ profile: { slug: 'demo-profile', links: [] } })
    api.getAnalytics.mockResolvedValue({ totalClicks: 0, daily: [], topLinks: [], devices: [] })
    api.createLink.mockResolvedValue({ link: { id: 'created-link', title: 'Portfolio', destinationUrl: 'https://example.com/', enabled: true, displayOrder: 0 } })
    render(<App />)
    await user.click(await screen.findByRole('button', { name: /add a new link/i }))
    await user.type(screen.getByLabelText('Link title'), 'Portfolio')
    await user.type(screen.getByLabelText('Destination URL'), 'example.com')
    fireEvent.submit(screen.getByLabelText('Link title').closest('form'))
    await waitFor(() => expect(api.createLink).toHaveBeenCalled())
    expect(api.createLink.mock.calls[0][0].destinationUrl).toMatch(/^https:\/\//)
    expect(await screen.findByText('Portfolio')).toBeTruthy()
  })

  it('previews unsaved appearance settings in mobile and desktop without publishing', async () => {
    const user = userEvent.setup()
    api.me.mockResolvedValue({ user: { id: 'user-id', email: 'demo@example.com', username: 'demo' } })
    api.getProfile.mockResolvedValue({ profile: { id: 'profile-id', slug: 'demo-profile', displayName: 'Demo Creator', bio: 'A creative profile', enabled: true, theme: 'soft', layout: 'classic' } })
    api.getLinks.mockResolvedValue({ links: [{ id: 'link-id', title: 'Portfolio', destinationUrl: 'https://example.com', displayOrder: 0, enabled: true }] })
    api.publicProfile.mockResolvedValue({ profile: { slug: 'demo-profile', links: [] } })
    api.getAnalytics.mockResolvedValue({ totalClicks: 0, daily: [], topLinks: [], devices: [] })
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Appearance' }))
    await user.clear(screen.getByLabelText('Display name'))
    await user.type(screen.getByLabelText('Display name'), 'Draft Creator')
    await user.selectOptions(screen.getByLabelText('Public layout'), 'portfolio')
    await user.click(screen.getByRole('button', { name: 'Preview' }))
    expect(await screen.findByRole('heading', { name: 'Draft Creator' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Projects & links' })).toBeTruthy()
    expect(screen.getAllByText('Portfolio').length).toBeGreaterThanOrEqual(1)
    await user.click(screen.getByRole('button', { name: 'Mobile' }))
    expect(document.querySelector('.preview-stage-mobile .layout-portfolio')).toBeTruthy()
    expect(api.updateProfile).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Back to editing' }))
    expect(screen.getByLabelText('Display name').value).toBe('Draft Creator')
  })

  it('saves customization fields through the existing profile API', async () => {
    const user = userEvent.setup()
    api.me.mockResolvedValue({ user: { id: 'user-id', email: 'demo@example.com', username: 'demo' } })
    api.getProfile.mockResolvedValue({ profile: { id: 'profile-id', slug: 'demo-profile', displayName: 'Demo Creator', enabled: true, theme: 'soft' } })
    api.getLinks.mockResolvedValue({ links: [] })
    api.publicProfile.mockResolvedValue({ profile: { slug: 'demo-profile', links: [] } })
    api.getAnalytics.mockResolvedValue({ totalClicks: 0, daily: [], topLinks: [], devices: [] })
    api.updateProfile.mockResolvedValue({ profile: { id: 'profile-id', slug: 'demo-profile', displayName: 'Demo Creator', layout: 'grid' } })
    render(<App />)
    await user.click(await screen.findByRole('button', { name: 'Appearance' }))
    await user.selectOptions(screen.getByLabelText('Theme preset'), 'gradient')
    await user.selectOptions(screen.getByLabelText('Public layout'), 'grid')
    await user.selectOptions(screen.getByLabelText('Font'), 'mono')
    await user.selectOptions(screen.getByLabelText('Link button style'), 'square')
    await user.click(screen.getByRole('button', { name: /save profile/i }))
    await waitFor(() => expect(api.updateProfile).toHaveBeenCalled())
    expect(api.updateProfile.mock.calls[0][0]).toMatchObject({ theme: 'gradient', layout: 'grid', fontFamily: 'mono', buttonStyle: 'square', backgroundColor: '#f1eaff', accentColor: '#7958e8' })
  })
})
