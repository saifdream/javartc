/**
 * Created by saif-dream on 8/7/2016.
 */
(function(angular) {
    'use strict';

    var videoCallApp = angular.module('videoCallApp',['ngAnimate']);

    var videoCallController = videoCallApp.controller('videoCallController',
        function($scope,$log,Socket,Server,browserChecker,$sce,VideoStream,UserMedia) {

        window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
        window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
        window.URL = window.URL || window.webkitURL || window.msURL || window.mozURL;

        $scope.loginPage = document.querySelector('#loginPage');
        $scope.usernameInput = document.querySelector('#usernameInput');

        $scope.loginBtn = document.querySelector('#loginBtn');
        $scope.loginBtn.onclick = logIn;

        $scope.callPage = document.querySelector('#callPage');
        $scope.callPage.style.display = "none";

        $scope.callToTargetUser = document.querySelector('#callToTargetUser');

        $scope.callBtn = document.querySelector('#callBtn');
        $scope.callBtn.onclick = call;

        $scope.hangUpBtn = document.querySelector('#hangUpBtn');
        $scope.hangUpBtn.onclick = hangup;

        var localVideo = document.querySelector('#localVideo');
        var remoteVideo = document.querySelector('#remoteVideo');
        var localStream;
        $scope.localVideoStream = '';
        $scope.remoteVideoStream = '';

        $scope.sdpConstraints = browserChecker.getBrowser();

        $scope.whoAmI;
        $scope.targetUser;
        $scope.peerConnection = '';

        $scope.Socket = new Socket();
        $scope.peer = $scope.Socket.webSocket;

        $scope.peer.onopen = function() {
            $log.log("Connected to the signaling server");
        };

        $scope.peer.oniceconnectionstatechange = function(e) {
            onIceStateChange(webSocket, e);
            $log.log("ICE State has changed.");
        };

        $scope.peer.onerror = function(err) {
            $log.log("Got WebSocket error", err);
        };

        $scope.peer.onmessage = function(msg) {
            //$log.log(msg);
            if(msg.data === "Connection Established"){
                return;
            }
            if(msg.data !== null){
                $scope.data = JSON.parse(msg.data);
                $scope.targetUser = $scope.data.whoAmI;
            }

            delete $scope.data.whoAmI;
            delete $scope.data.targetUser;

            switch($scope.data.type) {
                case "login":
                    handleLogin($scope.data.success);
                    break;
                //when somebody wants to call us
                case "offer":
                    delete $scope.data.type;
                    //$log.log($scope.data);
                    handleOffer($scope.data.offer);
                    break;
                case "answer":
                    delete $scope.data.type;
                    //$log.log($scope.data);
                    handleAnswer($scope.data.answer);
                    break;
                case "candidate":
                    delete $scope.data.type;
                    //$log.log($scope.data);
                    handleCandidate($scope.data.candidate);
                    break;
                case "list":
                    $log.log($scope.data);
                    setUserList($scope.data);
                    break;
                case "leave":
                    delete $scope.data.type;
                    //$log.log($scope.data);
                    handleLeave();
                    break;
                default:
                    break;
            }
        };

        function logIn () {
            //$scope.whoAmI = usernameInput.value;
            if ($scope.whoAmI.length > 0) {
                send({
                    type: "login",
                    whoAmI: $scope.whoAmI
                });
            }
        }

        function handleLogin(success) {
            if (success === false) {
                alert("Ooops...try a different name");
            } else {
                $scope.loginPage.style.display = "none";
                $scope.callPage.style.display = "block";

                captureVideo();
            }
        }

        function captureVideo() {
            UserMedia.get().then(function(stream) {
                $log.log('starting video');
                window.stream = stream; // stream available to console for dev
                localStream = stream;
                if (window.URL) {
                    $log.log('using window.URL');
                    $scope.localVideoStream = $sce.trustAsResourceUrl(window.URL.createObjectURL(stream));
                    localVideo.muted = true;
                    $log.log('Received local stream');
                } else {
                    $scope.localVideoStream = $sce.trustAsResourceUrl(stream);
                    localVideo.muted = true;
                    $log.log('Received local stream');
                }
            });
        }

        function gotRemoteStream(event) {
            remoteVideo.src = window.URL.createObjectURL(event.stream);
            $log.log('Received Remote stream.');
        }

        function setPeerConnection(){
            $scope.Server = new Server();
            $scope.peerConnection = $scope.Server.getPeerConnection();

            if ($scope.peerConnection){$log.log("RTCPeerConnection object was created")}

            $scope.peerConnection.onicecandidate = function(event) {
                if(typeof event.candidate == 'undefined') {
                    $log.error("Candidate is undefined.");
                }
                if(event.candidate) {
                    $log.info("The ICE candidate (transport address: '" + event.candidate.candidate + "') has been added to this connection.");
                    setTimeout(send({
                        type: "candidate",
                        candidate: event.candidate
                    }),2000);
                } else {
                    $log.log("All ICE candidates have been sent");
                }
            };

            $scope.peerConnection.oniceconnectionstatechange = function(event) {
                onIceStateChanges(event);
            };

            $scope.peerConnection.ongatheringchange =  function(e) {
                if (e.currentTarget && e.currentTarget.iceGatheringState === 'complete') {
                    $log.log("e.currentTarget && e.currentTarget.iceGatheringState complete'");
                }
            };

            $scope.peerConnection.onidentityresult = function( ev ) {
                $log.info("A new identity assertion (blob: '" + ev.assertion + "') has been generated.");
            }

            $scope.peerConnection.onidpassertionerror = function( ev ) {
                $log.info("The idp named '" + ev.idp + "' encountered an error " + "while generating an assertion.");
            }

            $scope.peerConnection.onsignalingstatechange = stateCallback;
            $scope.peerConnection.oniceconnectionstatechange = iceStateCallback;

            $scope.peerConnection.addStream(localStream);
            $scope.peerConnection.onaddstream = gotRemoteStream;
            $log.log('Added local stream to peerConnection.');
        }

        function handleCandidate(candidate) {
            $scope.peerConnection.addIceCandidate(
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

        function call() {
            //$scope.callBtn.disabled = true;
            //$scope.hangUpBtn.disabled = false;
            setPeerConnection();

            $log.log('Starting Call ...');

            if ($scope.targetUser.length > 0) {
                $scope.peerConnection.createOffer($scope.sdpConstraints).then(function (offer) {
                    $log.log('peer setLocalDescription start');
                    return $scope.peerConnection.setLocalDescription(offer).then(
                        onSetLocalSuccess, onSetSessionDescriptionError
                    );
                }).then(function () {
                    setTimeout(send({
                        type: "offer",
                        offer: $scope.peerConnection.localDescription
                    }),2000);
                }).catch(function (reason) {
                    $log.error("An error occurred, so handle the failure to connect: " + reason);
                });
            }

            //setInterval(getUserList(), 5000);
        }

        function handleOffer(offer) {
            //$scope.callBtn.disabled = true;
            //$scope.hangUpBtn.disabled = false;
            setPeerConnection();

            $log.log('Starting Answer ...');

            $log.log('peer createAnswer start');
            $scope.peerConnection.setRemoteDescription(new RTCSessionDescription(offer), function() {
                $scope.peerConnection.createAnswer(function(answer) {
                    $scope.peerConnection.setLocalDescription(answer, function() {
                        setTimeout(send({
                            type: "answer",
                            answer: $scope.peerConnection.localDescription
                        }),2000);
                    }, onCreateSessionDescriptionError);
                }, onSetSessionDescriptionError, $scope.sdpConstraints);
            }, onSetSessionDescriptionError);
        }

        function handleAnswer(answer) {
            $log.log('peer setRemoteDescription start');
            $scope.peerConnection.setRemoteDescription(
                new RTCSessionDescription(answer), onSetRemoteSuccess, onSetSessionDescriptionError
            );
        }

        function onIceStateChanges(event) {
            if ($scope.peerConnection) {
                $log.log('ICE state: ' + peerConnection.iceConnectionState);
                $log.log('ICE state change event: ', event);
            }
        }

        function onAddIceCandidateSuccess() {
            $log.log('AddIceCandidate success');
        }

        function onAddIceCandidateError(error) {
            $log.error('Failed to add ICE Candidate: ' + error.toString());
        }

        function onCreateSessionDescriptionError(error) {
            $log.error('Failed to create session description: ' + error.toString());
        }

        function onSetLocalSuccess() {
            $log.log('SetLocalDescription complete');
        }

        function onSetRemoteSuccess() {
            $log.log('SetRemoteDescription complete');
        }

        function onSetSessionDescriptionError(error) {
            $log.error('Failed to set session description: ' + error.toString());
        }

        function iceStateCallback() {
            $scope.iceState;
            if ($scope.peerConnection) {
                $scope.iceState = $scope.peerConnection.iceConnectionState;
                $log.info('Peer ICE connection state change callback, state: ' + $scope.iceState);
            }
        }

        function stateCallback() {
            $scope.state;
            if ($scope.peerConnection) {
                $scope.state = $scope.peerConnection.signalingState || $scope.peerConnection.readyState;
                $log.info('peerConnection state change callback, state: ' + $scope.state);
            }
        }

        function send (message) {
            if ($scope.targetUser) {
                $log.log("connectedUser: "+$scope.targetUser);
                message.whoAmI = $scope.whoAmI;
                message.targetUser = $scope.targetUser;
            }
            if(!$scope.peer){
                $scope.peer = $scope.socket.webSocket;
            }
            $scope.peer.send(JSON.stringify(message));
        }

        function setUserList(data){
            $log.log("User List request has been send.");
            $log.log( data.userList);
        }

        function getUserList(){
            $log.log("User List request has been send.");
            send({
                type: "list"
            });
        }

        function hangup() {
            $log.info('Ending Call ...');
            send({
                type: "leave"
            });
            $scope.remoteVideoStream = null;
            $scope.peerConnection.onicecandidate = null;
            $scope.peerConnection.onaddstream = null;
            $scope.peerConnection.close();
            //$scope.peerConnection = null;
            //$scope.hangUpBtn.disabled = true;
            //$scope.callBtn.disabled = false;
        }
        function handleLeave() {
            hangup();
            $scope.targetUser = null;
            remoteVideo.src = null;
        }
    });

    videoCallApp.factory('Server', function(){
        if (!window.RTCPeerConnection) {
            console.error = 'WebRTC is not supported by your browser. You can try the app with Chrome and Firefox Or another version..';
            return;
        }
        window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
        function Server () {
            this.DtlsSrtpKeyAgreement = { DtlsSrtpKeyAgreement: true };
            this.RtpDataChannels = { RtpDataChannels: true };
            this.optional = { optional: [this.DtlsSrtpKeyAgreement, this.RtpDataChannels] };

            this.STUN = { urls:'stun:numb.viagenie.ca:3478', credential:'n15255161525516', username:'saif89.2012@gmail.com' };
            this.TURN = { urls:'turn:numb.viagenie.ca:3478', credential:'n15255161525516', username:'saif89.2012@gmail.com' };

            this.iceServers = { iceServers: [ this.STUN, this.TURN ] };
        }
        Server.prototype.getPeerConnection = function() {
            this.PeerConnection = new RTCPeerConnection(this.iceServers, this.optional);
            return this.PeerConnection;
        }
        return Server;
    });

    videoCallApp.factory('Socket', function(){
        function Socket () {
            this.webSocket = new WebSocket("wss://" + location.hostname + ":" + location.port + "/videoChat/");
        }
        return Socket;
    });

    videoCallApp.service('browserChecker', function(){
        function getBrowser () {
            var browser = '';
            var sdpConstraints;

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

            return sdpConstraints;
        }
        return({getBrowser : getBrowser});
    });

    videoCallApp.factory('VideoStream', function ($q) {
        var stream;
        return {
            get: function () {
                if (stream) {
                    return $q.when(stream);
                } else {
                    var d = $q.defer();
                    navigator.getUserMedia({
                        video: true,
                        audio: true
                    }, function (s) {
                        stream = s;
                        d.resolve(stream);
                    }, function (e) {
                        d.reject(e);
                    });
                    return d.promise;
                }
            }
        };
    });

    videoCallApp.service('UserMedia', ['$q', function($q) {
        if (!navigator.getUserMedia) {
            console.error = 'WebRTC is not supported by your browser. You can try the app with Chrome and Firefox Or another version..';
            return;
        }
        navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
        var MediaConstraints = {
            audio: true,
            video: true
        };
        var deferred = $q.defer();
        var get = function() {
            navigator.getUserMedia(
                MediaConstraints,
                function(stream) { deferred.resolve(stream); },
                function errorCallback(error) {
                    console.log('navigator.getUserMedia error: ', error);
                    deferred.reject(error);
                }
            );
            return deferred.promise;
        }
        return {
            get: get
        }
    }]);

})(window.angular);
