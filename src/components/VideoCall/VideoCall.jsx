import { useEffect, useRef, useState } from 'react'
import { db } from '../../firebase/config'
import {
  doc, collection, addDoc, setDoc, getDoc,
  onSnapshot, updateDoc, deleteDoc, serverTimestamp
} from 'firebase/firestore'
import './VideoCall.css'

// Бесплатные STUN серверы Google
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
}

export default function VideoCall({ callId, isIncoming, callerName, user, onEnd }) {
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const pcRef = useRef(null)
  const localStreamRef = useRef(null)

  const [connected, setConnected] = useState(false)
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(false)
  const [status, setStatus] = useState(isIncoming ? 'Входящий звонок...' : 'Звоним...')

  const cleanup = () => {
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    pcRef.current?.close()
  }

  const endCall = async () => {
    cleanup()
    try {
      await updateDoc(doc(db, 'calls', callId), { ended: true })
    } catch {}
    onEnd()
  }

  useEffect(() => {
    let unsubAnswer, unsubRemoteCandidates, unsubCall

    const start = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      localStreamRef.current = stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }

      const pc = new RTCPeerConnection(ICE_SERVERS)
      pcRef.current = pc

      stream.getTracks().forEach(track => pc.addTrack(track, stream))

      pc.ontrack = e => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = e.streams[0]
        }
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setConnected(true)
          setStatus('Соединено')
        }
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          endCall()
        }
      }

      const callRef = doc(db, 'calls', callId)

      if (!isIncoming) {
        // Звонящий создаёт offer
        pc.onicecandidate = async e => {
          if (e.candidate) {
            await addDoc(collection(db, 'calls', callId, 'callerCandidates'), e.candidate.toJSON())
          }
        }

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await setDoc(callRef, {
          offer: { type: offer.type, sdp: offer.sdp },
          callerName: user.displayName,
          callerId: user.uid,
          createdAt: serverTimestamp(),
          ended: false
        })

        // Ждём answer
        unsubAnswer = onSnapshot(callRef, async snap => {
          const data = snap.data()
          if (data?.answer && !pc.currentRemoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer))
          }
          if (data?.ended) endCall()
        })

        // Получаем ICE candidates от принимающего
        unsubRemoteCandidates = onSnapshot(
          collection(db, 'calls', callId, 'calleeCandidates'),
          snap => {
            snap.docChanges().forEach(async change => {
              if (change.type === 'added') {
                await pc.addIceCandidate(new RTCIceCandidate(change.doc.data()))
              }
            })
          }
        )
      } else {
        // Принимающий создаёт answer
        pc.onicecandidate = async e => {
          if (e.candidate) {
            await addDoc(collection(db, 'calls', callId, 'calleeCandidates'), e.candidate.toJSON())
          }
        }

        const callSnap = await getDoc(doc(db, 'calls', callId))
        const callData = callSnap.data()
        await pc.setRemoteDescription(new RTCSessionDescription(callData.offer))

        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await updateDoc(doc(db, 'calls', callId), {
          answer: { type: answer.type, sdp: answer.sdp }
        })

        // Получаем ICE candidates от звонящего
        unsubRemoteCandidates = onSnapshot(
          collection(db, 'calls', callId, 'callerCandidates'),
          snap => {
            snap.docChanges().forEach(async change => {
              if (change.type === 'added') {
                await pc.addIceCandidate(new RTCIceCandidate(change.doc.data()))
              }
            })
          }
        )

        // Следим за завершением
        unsubCall = onSnapshot(doc(db, 'calls', callId), snap => {
          if (snap.data()?.ended) endCall()
        })
      }
    }

    start().catch(err => {
      alert('Ошибка доступа к камере: ' + err.message)
      onEnd()
    })

    return () => {
      unsubAnswer?.()
      unsubRemoteCandidates?.()
      unsubCall?.()
      cleanup()
    }
  }, [])

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setMuted(m => !m)
  }

  const toggleCamera = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
    setCameraOff(c => !c)
  }

  return (
    <div className="video-call-screen">
      <video ref={remoteVideoRef} className="remote-video" autoPlay playsInline />

      <div className="call-status-bar">
        <span>{callerName || 'Собеседник'}</span>
        <span className="call-status-text">{status}</span>
      </div>

      <video
        ref={localVideoRef}
        className="local-video"
        autoPlay
        playsInline
        muted
      />

      <div className="call-controls">
        <button
          className={`ctrl-btn ${muted ? 'ctrl-off' : ''}`}
          onClick={toggleMute}
        >
          {muted ? '🔇' : '🎤'}
          <span>{muted ? 'Вкл звук' : 'Выкл звук'}</span>
        </button>

        <button className="ctrl-btn end-call-btn" onClick={endCall}>
          📵
          <span>Завершить</span>
        </button>

        <button
          className={`ctrl-btn ${cameraOff ? 'ctrl-off' : ''}`}
          onClick={toggleCamera}
        >
          {cameraOff ? '📵' : '📹'}
          <span>{cameraOff ? 'Вкл камеру' : 'Выкл камеру'}</span>
        </button>
      </div>
    </div>
  )
}
