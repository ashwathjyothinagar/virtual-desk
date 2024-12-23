const signalingServer = new WebSocket('wss://virtual-desk-xf5i.onrender.com');

    let peerConnection;
    const localVideo = document.getElementById('localVideo');
    const remoteVideo = document.getElementById('remoteVideo');

    document.getElementById('callButton').addEventListener('click', async () => {
      signalingServer.send(JSON.stringify({ type: 'call', hotelId: 'Hotel1' }));
    });

    signalingServer.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'callStart') {
        setupWebRTC();
      } else if (message.type === 'signal') {
        await handleSignal(message.payload);
      }
    };

    async function setupWebRTC() {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.srcObject = stream;

      peerConnection = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

      peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
      };

      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          signalingServer.send(JSON.stringify({ type: 'signal', payload: { candidate: event.candidate } }));
        }
      };

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      signalingServer.send(JSON.stringify({ type: 'signal', payload: { sdp: peerConnection.localDescription } }));
    }

    async function handleSignal(payload) {
      if (payload.sdp) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        if (payload.sdp.type === 'offer') {
          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);
          signalingServer.send(JSON.stringify({ type: 'signal', payload: { sdp: peerConnection.localDescription } }));
        }
      } else if (payload.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(payload.candidate));
      }
    }
