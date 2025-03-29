"use client"

import FileManager from "./components/FileManager"

export default function S3ManagerPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <FileManager />
    </div>
  )
}