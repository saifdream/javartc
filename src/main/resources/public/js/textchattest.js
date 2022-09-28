/**
 * Created by saif-dream on 7/25/2016.
 */
/**
 * Created by saif-dream on 7/20/2016.
 */
var name;
var connectedUser;

var loginPage = document.querySelector('#loginPage');
var usernameInput = document.querySelector('#usernameInput');
var loginBtn = document.querySelector('#loginBtn');

var callPage = document.querySelector('#callPage');
var callToUsernameInput = document.querySelector('#callToUsernameInput');
var callBtn = document.querySelector('#callBtn');

var hangUpBtn = document.querySelector('#hangUpBtn');
var msgInput = document.querySelector('#msgInput');
var sendMsgBtn = document.querySelector('#sendMsgBtn');

var chatArea = document.querySelector('#chatarea');
var dataChannel;
var receiveChannel;

callPage.style.display = "none";

var sdpConstraints = { OfferToReceiveAudio: true, OfferToReceiveVideo: true };
var webSocket = new WebSocket("ws://" + location.hostname + ":" + location.port + "/chat/");

var iceServers = { iceServers: [
    { url:'stun:numb.viagenie.ca:3478', credential:'n15255161525516', username:'saif89.2012@gmail.com' },
    { url:'stun:stun.l.google.com:19302' },
    { url:'stun:stun2.1.google.com:19302' },
    { url:'stun:23.21.150.121' },
    { url:'turn:numb.viagenie.ca:3478', credential:'n15255161525516', username:'saif89.2012@gmail.com' },
    { url:'turn:192.158.29.39:3478?transport=udp', credential:'JZEOEt2V3Qb0y27GRntt2u2PAYA=', username:'28224511:1379330808' },
    { url:'turn:192.158.29.39:3478?transport=tcp', credential:'JZEOEt2V3Qb0y27GRntt2u2PAYA=', username:'28224511:1379330808' }
] };

// DTLS/SRTP is preferred on chrome to interop with Firefox which supports them by default
var DtlsSrtpKeyAgreement = { DtlsSrtpKeyAgreement: true };
var RtpDataChannels = { RtpDataChannels: true };
var optional = { optional: [DtlsSrtpKeyAgreement, RtpDataChannels] };

var peer = "";

webSocket.onopen = function () {
    console.log("Connected to the signaling server");
};

webSocket.onerror = function (err) {
    console.log("Got WebSocket error", err);
};

webSocket.onmessage = function (msg) {
    console.log(msg.data);
    if(msg.data === "Connection Established"){
        return;
    }

    var data = JSON.parse(msg.data);

    switch(data.type) {
        case "login":
            handleLogin(data.success);
            break;
        //when somebody wants to call us
        case "offer":
            handleOffer(data.offer, data.name);
            break;
        case "answer":
            handleAnswer(data.answer);
            break;
        //when a remote peer sends an ice candidate to us
        case "candidate":
            handleCandidate(data.candidate);
            break;
        case "leave":
            handleLeave();
            break;
        default:
            break;
    }
};

function send(message) {
    if (connectedUser) {
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
        initPeer();
    }
};

function initPeer(){
    peer = new mozRTCPeerConnection(iceServers, optional);

    if (peer) {console.log("RTCPeerConnection object was created")}

    peer.onicecandidate = function(event) {
        var candidate = event.candidate;
        if(typeof candidate == 'undefined') {
            console.error("Candidate is undefined.");
        }
        if(candidate) {
            send({
                type: "candidate",
                candidate: candidate,
                name: callToUsernameInput.value
            });
        }
    };

    peer.ondatachannel = function(event) {
        receiveChannel = event.channel;
        receiveChannel.onmessage = function(event){
            chatArea.innerHTML += callToUsernameInput.value + ": " + event.data + "<br />";
        };
    };

    peer.ongatheringchange =  function(e) {
        if (e.currentTarget && e.currentTarget.iceGatheringState === 'complete') {
            console.log("e.currentTarget && e.currentTarget.iceGatheringState complete'");
        }
    };

    peer.onidentityresult = function( ev ) {
        console.info("A new identity assertion (blob: '" + ev.assertion + "') has been generated.");
    }

    peer.onidpassertionerror = function( ev ) {
        console.info("The idp named '" + ev.idp + "' encountered an error " + "while generating an assertion.");
    }

    peer.onsignalingstatechange = stateCallback;
    peer.oniceconnectionstatechange = iceStateCallback;

    //creating data channel
    dataChannel = peer.createDataChannel("channel1", {reliable:false});

    dataChannel.onerror = function (error) {
        console.log("Ooops...error:", error);
    };

    //when we receive a message from the other peer, display it on the screen
    dataChannel.onmessage = function (event) {
        chatArea.innerHTML += callToUsernameInput.value + ": " + event.data + "<br />";
    };

    dataChannel.onclose = function () {
        console.log("data channel is closed");
    };
}

webSocket.oniceconnectionstatechange = function(e) {
    console.log("ICE State has changed.");
    onIceStateChange(webSocket, e);
};

callBtn.addEventListener("click", function () {
    var callToUsername = callToUsernameInput.value;
    if (callToUsername.length > 0) {
        connectedUser = callToUsername;
        //callBtn.disabled = true;

        if (!peer) {
            initPeer();
        }

        peer.createOffer(function(offerSDP) {
            peer.setLocalDescription(offerSDP, successCallback, failureCallback);
            send({
                type: "offer",
                offer: offerSDP
            });
        }, onFailure, sdpConstraints);
    }
});

function handleOffer(offer, name) {
    connectedUser = callToUsernameInput.value;
    // remote-descriptions should be set earlier
    // using offer-sdp provided by the offerer
    var remoteDescription = new mozRTCSessionDescription(offer);
    peer.setRemoteDescription(remoteDescription, successCallback, failureCallback);

    peer.createAnswer(function(answerSDP) {
        peer.setLocalDescription(answerSDP, successCallback, failureCallback);
        send({
            type: "answer",
            answer: answerSDP,
            name: callToUsernameInput.value
        });
    }, onFailure, sdpConstraints);
}

function iceStateCallback() {
    var iceState;
    if (peer) {
        iceState = peer.iceConnectionState;
        console.log('peer ICE connection state change callback, state: ' + iceState);
    }
}

function stateCallback() {
    var state;
    if (peer) {
        state = peer.signalingState || peer.readyState;
        console.log('peer state change callback, state: ' + state);
    }
}

function handleAnswer(answer) {
    var remoteDescription = new mozRTCSessionDescription(answer);
    peer.setRemoteDescription(remoteDescription, successCallback, failureCallback);
}

function handleCandidate(candidate) {

    peer.addIceCandidate(new mozRTCIceCandidate(candidate)).then(
        onAddIceCandidateSuccess,
        onAddIceCandidateError
    );
}

function successCallback() {
    console.info('Peer Description success.');
}

function failureCallback(error) {
    console.info('Peer Description Failed: ' + error.toString());
}

function onAddIceCandidateSuccess() {
    console.info('AddIceCandidate success.');
}

function onAddIceCandidateError(error) {
    console.info('Failed to add Ice Candidate: ' + error.toString());
}

//when user clicks the "send message" button
sendMsgBtn.addEventListener("click", function (event) {
    var msg = msgInput.value;
    chatArea.innerHTML += name + ": " + msg + "<br />";

    //sending a message to a connected peer
    dataChannel.send(msg);
    msgInput.value = "";
});

hangUpBtn.addEventListener("click", function () {
    callBtn.disabled = false;
    console.info("Leaving ...");
    send({
        type: "leave",
        name: callToUsernameInput.value
    });

    handleLeave();
});

function handleLeave() {
    connectedUser = null;
    peer.close();
    peer.onicecandidate = null;
    peer.onaddstream = null;
}

function onFailure(error) {
    console.error(error);
}
