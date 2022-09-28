/**
 * Created by saif-dream on 7/20/2016.
 */
var name;
var connectedUser;

var loginPage = document.querySelector('#loginPage');
var usernameInput = document.querySelector('#usernameInput');
var loginBtn = document.querySelector('#loginBtn');

var startButton = document.getElementById('startButton');
var callPage = document.querySelector('#callPage');
var callToUsernameInput = document.querySelector('#callToUsernameInput');
var callBtn = document.querySelector('#callBtn');

var hangUpBtn = document.querySelector('#hangUpBtn');

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
var localStream;

startButton.onclick = start;
callBtn.onclick = call;
hangUpBtn.onclick = hangup;

callPage.style.display = "none";

var sdpConstraints;
var webSocket = new WebSocket("wss://" + location.hostname + ":" + location.port + "/chat/");

var STUN = { urls:'stun:numb.viagenie.ca:3478', credential:'n15255161525516', username:'saif89.2012@gmail.com' };
var TURN = { urls:'turn:numb.viagenie.ca:3478', credential:'n15255161525516', username:'saif89.2012@gmail.com' };
var iceServers = { iceServers: [ STUN, TURN ] };

// DTLS/SRTP is preferred on chrome to interop with Firefox which supports them by default
var DtlsSrtpKeyAgreement = { DtlsSrtpKeyAgreement: true };
var RtpDataChannels = { RtpDataChannels: true };
var optional = { optional: [DtlsSrtpKeyAgreement, RtpDataChannels] };
var browser;
function browserChecker() {
    if((navigator.userAgent.indexOf("Opera") || navigator.userAgent.indexOf('OPR')) != -1 ) {
        browser = "Opera";
    } else if(navigator.userAgent.indexOf("Chrome") != -1 ) {
        browser = "Chrome";
        sdpConstraints = { mandatory: { OfferToReceiveAudio: true, OfferToReceiveVideo: true } };
    } else if(navigator.userAgent.indexOf("Safari") != -1) {
        browser = "Safari";
    } else if(navigator.userAgent.indexOf("Firefox") != -1 ) {
        browser = "Firefox";
        sdpConstraints = { offerToReceiveAudio: 1, offerToReceiveVideo: 1 };
    } else if((navigator.userAgent.indexOf("MSIE") != -1 ) || (!!document.documentMode == true )) { //IF IE > 10
        browser = "IE";
    } else if (document.documentMode || /Edge/.test(navigator.userAgent)) { // detect IE8 and above, and edge
        browser = "Edge";
    } else {
        browser = "unknown";
    }
    return browser;
}

browserChecker();

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
URL = window.URL || window.webkitURL || window.msURL || window.mozURL;

var peerConnection = "";

webSocket.onopen = function () {
    console.log("Connected to the signaling server");
};

webSocket.onerror = function (err) {
    console.log("Got WebSocket error", err);
};

webSocket.onmessage = function (msg) {
    console.log(msg);
    if(msg.data === "Connection Established"){
        return;
    }
    if(msg.data !== null){
        var data = JSON.parse(msg.data);
    }

    delete data.name;
    switch(data.type) {
        case "login":
            handleLogin(data.success);
            break;
        //when somebody wants to call us
        case "offer":
            delete data.type;
            console.log(data);
            handleOffer(data.offer, data.name);
            break;
        case "answer":
            delete data.type;
            console.log(data);
            handleAnswer(data.answer);
            break;
        //when a remote peer sends an ice candidate to us
        case "candidate":
            delete data.type;
            console.log(data);
            handleCandidate(data.candidate);
            break;
        case "leave":
            delete data.type;
            console.log(data);
            handleLeave();
            break;
        default:
            break;
    }
};

function send(message) {
    if (connectedUser) {
        console.log("connectedUser: "+connectedUser);
        message.name = callToUsernameInput.value;
    }

    webSocket.send(JSON.stringify(message));
};

loginBtn.addEventListener("click", function (event) {
    name = usernameInput.value;
    if (name.length > 0) {
        send({
            type: "login",
            name: name
        });
    }
});

function handleLogin(success) {
    if (success === false) {
        alert("Ooops...try a different name");
    } else {
        loginPage.style.display = "none";
        callPage.style.display = "block";
    }
};

function gotStream(stream) {
    console.log('Received local stream');
    localVideo.srcObject = stream;
    localStream = stream;
    callBtn.disabled = false;
}

function gotRemoteStream(e) {
    remoteVideo.srcObject = e.stream;
    console.log('Received Remote stream.');
}

function start() {
    console.log('Requesting local stream');
    startButton.disabled = true;

    var MediaConstraints = {
        audio: true,
        video: true
    };
    navigator.getUserMedia(MediaConstraints, gotStream, OnMediaError);
}

function OnMediaSuccess() {
    console.log("getUserMedia() success.");
}

function OnMediaError(e) {
    console.error('getUserMedia() error: ' + e.name);
}

function startPeerConnection () {
    var videoTracks = localStream.getVideoTracks();
    var audioTracks = localStream.getAudioTracks();

    if (videoTracks.length > 0) {
        console.log('Using video device: ' + videoTracks[0].label);
    }
    if (audioTracks.length > 0) {
        console.log('Using audio device: ' + audioTracks[0].label);
    }
    peerConnection = new RTCPeerConnection(iceServers, optional);
    /*if(browserChecker() === "Firefox"){
     peerConnection = new mozRTCPeerConnection(iceServers, optional);
     }

     if(browserChecker() === "Chrome"){
     peerConnection = new webkitRTCPeerConnection(iceServers, optional);
     }*/

    if (peerConnection){console.log("RTCPeerConnection object was created")}

    peerConnection.onicecandidate = function(event) {
        if(typeof event.candidate == 'undefined') {
            console.error("Candidate is undefined.");
        }
        if(event.candidate) {
            console.info("The ICE candidate (transport address: '" + event.candidate.candidate + "') has been added to this connection.");
            send({
                type: "candidate",
                candidate: event.candidate,
                name: callToUsernameInput.value
            });
        } else {
            console.log("All ICE candidates have been sent");
        }
        //onIceCandidate(event);
    };
    peerConnection.oniceconnectionstatechange = function(event) {
        onIceStateChanges(event);
    };
    peerConnection.onaddstream = gotRemoteStream;

    peerConnection.addStream(localStream);
    console.log('Added local stream to peerConnection.');

    peerConnection.ongatheringchange =  function(e) {
        if (e.currentTarget && e.currentTarget.iceGatheringState === 'complete') {
            console.log("e.currentTarget && e.currentTarget.iceGatheringState complete'");
        }
    }

    peerConnection.onidentityresult = function( ev ) {
        console.info("A new identity assertion (blob: '" + ev.assertion + "') has been generated.");
    }

    peerConnection.onidpassertionerror = function( ev ) {
        console.info("The idp named '" + ev.idp + "' encountered an error " + "while generating an assertion.");
    }

    peerConnection.onsignalingstatechange = stateCallback;
    peerConnection.oniceconnectionstatechange = iceStateCallback;
}

function call() {
    callBtn.disabled = true;
    hangUpBtn.disabled = false;
    console.log('Starting call');

    startPeerConnection ();

    var callToUsername = callToUsernameInput.value;

    if (callToUsername.length > 0) {
        connectedUser = callToUsername;
        //var offersdp;
        peerConnection.createOffer(sdpConstraints).then(function (offer) {
            //offersdp = offer;
            console.log('peer setLocalDescription start');
            return peerConnection.setLocalDescription(offer).then(
                function () {
                    onSetLocalSuccess();
                }, onSetSessionDescriptionError
            );
        }).then(function () {
            send({
                type: "offer",
                offer: peerConnection.localDescription,
                name: callToUsernameInput.value
            });
        }).catch(function (reason) {
            console.error("An error occurred, so handle the failure to connect: " + reason);
        });
    }
}

function handleOffer(offer, name) {
    startPeerConnection ();
    connectedUser = callToUsernameInput.value;
    // remote-descriptions should be set earlier using offer-sdp provided by the offerer
    /*var remoteDescription = new RTCSessionDescription(offer);
     peerConnection.setRemoteDescription(remoteDescription).then(function() {
     onSetRemoteSuccess();
     },onSetSessionDescriptionError);*/

    //console.log('offer.sdp: '+offer.sdp)
    console.log('peer createAnswer start');
    /*peerConnection.setRemoteDescription(new RTCSessionDescription(offer.sdp)).then(function() {
     onSetRemoteSuccess();
     },onSetSessionDescriptionError);*/

    peerConnection.setRemoteDescription(new RTCSessionDescription(offer), function() {
        peerConnection.createAnswer(function(answer) {
            peerConnection.setLocalDescription(answer, function() {
                // send the answer to a server to be forwarded back to the caller (you)
                send({
                    type: "answer",
                    answer: peerConnection.localDescription,
                    name: callToUsernameInput.value
                });
            }, onSetSessionDescriptionError);
        }, onSetSessionDescriptionError, sdpConstraints);
    }, onSetSessionDescriptionError);

    /*peerConnection.setRemoteDescription(offer.sdp, function () {
     // if we received an offer, we need to answer
     //if (peerConnection.remoteDescription.type == 'offer')
     //peerConnection.createAnswer(localDescCreated, logError);
     peerConnection.createAnswer().then(function(answer) {
     //answersdp = answer;
     console.log('peer setLocalDescription start');
     console.log(answer)
     console.log('answer: '+answer)
     return peerConnection.setLocalDescription(answer).then(
     function() {
     onSetLocalSuccess();
     }, onSetSessionDescriptionError
     );
     },failureCallback, sdpConstraints).then(function() {
     send({
     type: "answer",
     answer: peerConnection.localDescription //peerConnection.localDescription
     //name: callToUsernameInput.value
     });
     }).catch(function(reason) {
     console.error("An error occurred, so handle the failure to connect: "+reason);
     });
     }, onSetSessionDescriptionError);*/
    // Since the 'remote' side has no media stream we need to pass in the right constraints in order for it to
    // accept the incoming offer of audio and video.

    //var answersdp;
    /*peerConnection.createAnswer().then(function(answer) {
     //answersdp = answer;
     console.log('peer setLocalDescription start');
     return peerConnection.setLocalDescription(answer).then(
     function() {
     onSetLocalSuccess();
     }, onSetSessionDescriptionError
     );
     },onCreateSessionDescriptionError, sdpConstraints).then(function() {
     send({
     type: "answer",
     answer: peerConnection.localDescription,
     name: callToUsernameInput.value
     });
     }).catch(function(reason) {
     console.error("An error occurred, so handle the failure to connect: "+reason);
     });*/
}

function handleAnswer(answer) {
    //var remoteDescription = new RTCSessionDescription(answer);

    console.log('Answer from peer:\n' + answer.sdp);
    console.log('peer setRemoteDescription start');

    /*peerConnection.setRemoteDescription(remoteDescription).then(
     function() {
     onSetRemoteSuccess();
     }, onSetSessionDescriptionError
     );*/

    console.log('peer setRemoteDescription start');
    peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

    /*peerConnection.setRemoteDescription(answer.sdp, function () {
     // if we received an offer, we need to answer
     onSetRemoteSuccess();
     }, onSetSessionDescriptionError);*/
}

function onIceCandidate(event) {
    var candidate = event.candidate;
    if (event.candidate) {
        send({
            type: "candidate",
            candidate: event.candidate,
            name: callToUsernameInput.value
        });
    } else {
        console.log("All ICE candidates have been sent");
    }
}

function handleCandidate(candidate) {
    peerConnection.addIceCandidate(
        new RTCIceCandidate(candidate)
    ).then(
        function() {
            onAddIceCandidateSuccess();
        },
        function(err) {
            onAddIceCandidateError(err);
        }
    );
}

webSocket.oniceconnectionstatechange = function(e) {
    onIceStateChange(webSocket, e);
    console.log("ICE State has changed.");
};

function onIceStateChanges(webSocket, event) {
    if (peerConnection) {
        console.log('ICE state: ' + peerConnection.iceConnectionState);
        console.log('ICE state change event: ', event);
    }
}

function onAddIceCandidateSuccess() {
    console.log('AddIceCandidate success');
}

function onAddIceCandidateError(error) {
    console.error('Failed to add ICE Candidate: ' + error.toString());
}

function onCreateSessionDescriptionError(error) {
    console.error('Failed to create session description: ' + error.toString());
}

function onSetLocalSuccess() {
    console.log('SetLocalDescription complete');
}

function onSetRemoteSuccess() {
    console.log('SetRemoteDescription complete');
}

function onSetSessionDescriptionError(error) {
    console.error('Failed to set session description: ' + error.toString());
}

function iceStateCallback() {
    var iceState;
    if (peerConnection) {
        iceState = peerConnection.iceConnectionState;
        console.info('Peer ICE connection state change callback, state: ' + iceState);
    }
}

function stateCallback() {
    var state;
    if (peerConnection) {
        state = peerConnection.signalingState || peerConnection.readyState;
        console.info('peerConnection state change callback, state: ' + state);
    }
}

function hangup() {
    console.info('Ending call');
    send({
        type: "leave",
        name: callToUsernameInput.value
    });
    peerConnection.close();
    peerConnection = null;
    hangUpBtn.disabled = true;
    callBtn.disabled = false;
}