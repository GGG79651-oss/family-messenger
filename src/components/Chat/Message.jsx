import { useRef, useState } from 'react'
import './Message.css'

function formatTime(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function getAvatarColor(name) {
  const colors = ['#e94560', '#0f3460', '#533483', '#05668d', '#028090', '#00b4d8']
  let hash = 0
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return colors[Math.abs(hash) % colors.length]
}

function AudioMessage({ url }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  const toggle = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setPlaying(!playing)
  }

  const onTimeUpdate = () => {
    if (!audioRef.current) return
    setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100 || 0)
  }

  const onLoadedMetadata = () => {
    if (!audioRef.current) return
    setDuration(audioRef.current.duration)
  }

  const onEnded = () => setPlaying(false)

  const formatDuration = (s) => {
    if (!s || isNaN(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="audio-msg">
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
      />
      <button className="audio-play-btn" onClick={toggle}>
        {playing ? '⏸' : '▶'}
      </button>
      <div className="audio-track">
        <div className="audio-progress-bar">
          <div className="audio-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <span className="audio-duration">{formatDuration(duration)}</span>
      </div>
    </div>
  )
}

function VideoCircle({ url }) {
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef(null)

  const toggle = () => {
    if (!videoRef.current) return
    if (playing) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
    setPlaying(!playing)
  }

  return (
    <div className="video-circle-wrapper" onClick={toggle}>
      <video
        ref={videoRef}
        src={url}
        className="video-circle"
        playsInline
        loop
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      {!playing && (
        <div className="video-circle-overlay">▶</div>
      )}
    </div>
  )
}

export default function Message({ msg, isOwn, showAvatar }) {
  const renderContent = () => {
    switch (msg.type) {
      case 'text':
        return <p className="msg-text">{msg.text}</p>

      case 'image':
        return (
          <img
            className="msg-image"
            src={msg.url}
            alt="фото"
            onClick={() => window.open(msg.url, '_blank')}
          />
        )

      case 'video':
        return (
          <video
            className="msg-video"
            src={msg.url}
            controls
            playsInline
          />
        )

      case 'audio':
        return <AudioMessage url={msg.url} />

      case 'video-circle':
        return <VideoCircle url={msg.url} />

      case 'file':
        return (
          <a className="msg-file" href={msg.url} target="_blank" rel="noreferrer">
            <span className="msg-file-icon">📎</span>
            <span className="msg-file-name">{msg.fileName || 'Файл'}</span>
          </a>
        )

      default:
        return <p className="msg-text">{msg.text}</p>
    }
  }

  return (
    <div className={`msg-row ${isOwn ? 'own' : 'other'}`}>
      {!isOwn && (
        <div
          className="msg-avatar"
          style={{ background: getAvatarColor(msg.senderName), opacity: showAvatar ? 1 : 0 }}
        >
          {getInitials(msg.senderName)}
        </div>
      )}
      <div className="msg-bubble-wrap">
        {!isOwn && showAvatar && (
          <span className="msg-sender-name">{msg.senderName}</span>
        )}
        <div className={`msg-bubble ${isOwn ? 'bubble-out' : 'bubble-in'}`}>
          {renderContent()}
          <span className="msg-time">{formatTime(msg.createdAt)}</span>
        </div>
      </div>
    </div>
  )
}
