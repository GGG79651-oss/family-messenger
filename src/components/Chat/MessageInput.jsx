import { useState, useRef, useEffect } from 'react'
import { db, storage } from '../../firebase/config'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import './MessageInput.css'

const CHAT_ID = 'family-chat'

export default function MessageInput({ user }) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingType, setRecordingType] = useState(null) // 'audio' | 'video-circle'
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)

  const sendMessage = async (msgData) => {
    await addDoc(collection(db, 'chats', CHAT_ID, 'messages'), {
      ...msgData,
      senderId: user.uid,
      senderName: user.displayName || 'Без имени',
      createdAt: serverTimestamp(),
    })
  }

  const handleSendText = async (e) => {
    e.preventDefault()
    if (!text.trim() || sending) return
    const t = text.trim()
    setText('')
    setSending(true)
    try {
      await sendMessage({ type: 'text', text: t })
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendText(e)
    }
  }

  const uploadFile = async (blob, folder, fileName) => {
    const storageRef = ref(storage, `${folder}/${Date.now()}_${fileName}`)
    await uploadBytes(storageRef, blob)
    return await getDownloadURL(storageRef)
  }

  const handleFileSelect = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setShowAttachMenu(false)
    setUploading(true)

    try {
      let type = 'file'
      let folder = 'files'
      if (file.type.startsWith('image/')) { type = 'image'; folder = 'images' }
      else if (file.type.startsWith('video/')) { type = 'video'; folder = 'videos' }
      else if (file.type.startsWith('audio/')) { type = 'audio'; folder = 'audio' }

      setUploadProgress('Загрузка...')
      const url = await uploadFile(file, folder, file.name)
      await sendMessage({ type, url, fileName: file.name })
    } finally {
      setUploading(false)
      setUploadProgress('')
      e.target.value = ''
    }
  }

  const startRecording = async (type) => {
    try {
      const constraints = type === 'video-circle'
        ? { video: { facingMode: 'user', width: 300, height: 300 }, audio: true }
        : { audio: true }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      const mimeType = type === 'video-circle'
        ? (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4')
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4')

      const mr = new MediaRecorder(stream, { mimeType })
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }

      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: mimeType })
        setUploading(true)
        try {
          const folder = type === 'video-circle' ? 'video-circles' : 'audio'
          const ext = mimeType.includes('webm') ? 'webm' : 'mp4'
          const url = await uploadFile(blob, folder, `recording.${ext}`)
          await sendMessage({ type, url })
        } finally {
          setUploading(false)
        }
      }

      mr.start()
      mediaRecorderRef.current = mr
      setRecording(true)
      setRecordingType(type)
      setRecordingSeconds(0)

      timerRef.current = setInterval(() => {
        setRecordingSeconds(s => {
          if (type === 'video-circle' && s >= 59) {
            stopRecording()
            return s
          }
          return s + 1
        })
      }, 1000)
    } catch (err) {
      alert('Нет доступа к микрофону/камере. Проверьте разрешения.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    clearInterval(timerRef.current)
    setRecording(false)
    setRecordingType(null)
    setRecordingSeconds(0)
  }

  const handleAudioHold = () => startRecording('audio')
  const handleVideoCircle = () => {
    if (recording && recordingType === 'video-circle') {
      stopRecording()
    } else {
      startRecording('video-circle')
    }
  }

  useEffect(() => () => clearInterval(timerRef.current), [])

  const formatSec = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  if (recording) {
    return (
      <div className="input-bar recording-bar">
        <div className="rec-indicator">
          <span className="rec-dot" />
          <span className="rec-label">
            {recordingType === 'video-circle' ? 'Запись кружочка' : 'Запись аудио'} — {formatSec(recordingSeconds)}
          </span>
        </div>
        <button className="rec-stop-btn" onClick={stopRecording}>
          ⏹ Стоп
        </button>
      </div>
    )
  }

  return (
    <div className="input-bar">
      {uploading && (
        <div className="upload-indicator">{uploadProgress || 'Отправка...'}</div>
      )}

      {showAttachMenu && (
        <div className="attach-menu">
          <button onClick={() => { fileInputRef.current.accept = 'image/*'; fileInputRef.current.click() }}>
            🖼 Фото
          </button>
          <button onClick={() => { fileInputRef.current.accept = 'video/*'; fileInputRef.current.click() }}>
            🎬 Видео
          </button>
          <button onClick={() => { fileInputRef.current.accept = '*/*'; fileInputRef.current.click() }}>
            📎 Файл
          </button>
          <button className="close-attach" onClick={() => setShowAttachMenu(false)}>✕</button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      <button
        className="input-icon-btn"
        onClick={() => setShowAttachMenu(v => !v)}
        title="Прикрепить файл"
      >
        ➕
      </button>

      <textarea
        ref={textareaRef}
        className="msg-textarea"
        placeholder="Сообщение..."
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={1}
      />

      {text.trim() ? (
        <button
          className="send-btn"
          onClick={handleSendText}
          disabled={sending}
        >
          ➤
        </button>
      ) : (
        <>
          <button
            className="input-icon-btn"
            onPointerDown={handleAudioHold}
            onPointerUp={stopRecording}
            onPointerLeave={stopRecording}
            title="Удерживайте для записи аудио"
          >
            🎤
          </button>
          <button
            className={`input-icon-btn ${recording && recordingType === 'video-circle' ? 'recording' : ''}`}
            onClick={handleVideoCircle}
            title="Записать видео-кружочек"
          >
            ⭕
          </button>
        </>
      )}
    </div>
  )
}
