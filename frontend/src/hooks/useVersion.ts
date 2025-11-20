import { useState, useEffect } from 'react'

interface VersionInfo {
  buildDate: string
  gitCommit: string
  gitBranch: string
  version: string
}

export function useVersion() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null)

  useEffect(() => {
    fetch('/api/version')
      .then((res) => res.json())
      .then((data) => setVersionInfo(data))
      .catch((err) => console.error('Failed to fetch version info:', err))
  }, [])

  return versionInfo
}
