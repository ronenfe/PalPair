var PalPair = PalPair || {};

// todo:
//  cleanup: proper module loading
//  cleanup: promises to clear up some of the async chaining
//  feature: multiple chat partners

PalPair.Chat = (function (viewModel, connectionManager) {
    var _mediaStream,
        _hub, _isChatActive = true;
    _connect = function (onSuccess, onFailure) {
        // Set Up SignalR Signaler
        // Declare a proxy to reference the hub.
        // Kick off the app
        var hub = $.connection.palPairHub;
        $.connection.hub.start()
            .done(function () {
                console.log('connected to SignalR hub... connection id: ' + hub.connection.id);
                if (onSuccess) {
                    onSuccess(hub);
                }
            })
            .fail(function (event) {
                if (onFailure) {
                    onFailure(event);
                }
            });
        _hub = hub;
        // Setup client SignalR operations
        _setupHubCallbacks();


    },
    _start = function () {
        // Show warning if WebRTC support is not detected
       /* if (webrtcDetectedBrowser == null) {
            console.log('Your browser doesnt appear to support WebRTC.');
            app.Views.Home.errorMessage({
                html: '<h4>Your browser does not appear to support PalPair.</h4> Try either the <a href="https://www.google.com/intl/en/chrome/browser"> latest Google Chrome</a> or <a href="http://opera.com/download">latest Opera</a> to join the fun.',
                css: 'alert-danger'
            })
        }*/

        // Then proceed to the next step, gathering username
        _startSession();
    },

        _startSession = function () {
            app.Views.Home.loadingChat(true); // Turn on the loading indicator
            // Initialize our client signal manager, giving it a signaler (the SignalR hub) and some callbacks
            _connect(function (_hub) {
                console.log('initializing connection manager');
                connectionManager.initialize(_hub.server, _callbacks.onReadyForStream, _callbacks.onStreamAdded, _callbacks.onStreamRemoved);
                // Get user Details
                _hub.server.getMyUserDetails().done(function (me) {
                    app.Views.Home.me(me);
                });
                // Get number of users
                _hub.server.getNumberOfConnectedUsers();
                // Hook up the UI
                _attachUiHandlers();
            },
            function (event) {
                app.Views.Home.errorMessage({
                    html: '<h4>Failed SignalR Connection</h4> We were not able to connect you to the signaling server, try again or contact support.<br/><br/>Error: ' + JSON.stringify(event),
                    css: 'alert-danger'
                });
                app.Views.Home.loadingChat(false);
            });
            // Ask the user for permissions to access the webcam and mic
            navigator.mediaDevices.getUserMedia(
                {
                    // Permissions to request
                    video: true,
                    audio: true
                }).then(gotStream).catch(function(e) {
                    app.Views.Home.isBtnStartStopDisabled(false);
                    app.Views.Home.errorMessage({
                        html: '<4>Failed to get hardware access!</h4> Actual Error: ' + JSON.stringify(e),
                        css: 'alert-warning'
                });
                    app.Views.Home.loadingChat(false);
                });
        },
     _setupHubCallbacks = function () {
         // Hub Callback: WebRTC Signal Received
         _hub.client.receiveSignal = function (callingUser, data) {
             connectionManager.newSignal(callingUser.ConnectionId, data);
         };
         // On User Disconnected
         _hub.client.onUserDisconnected = function () {
    //         setDisplayToStopped();
         }
         _hub.client.UpdateConnectedUsers = function (num, males) {
             app.Views.Home.connectedUsers('Connected Users: ' + num + '. Males: ' + Math.round(males / num * 100) + '%, Females:' + Math.round((num - males) / num * 100) + '%');
         };
         _hub.client.test = function () {
             alert('test');
         }
         // On chattingUser Disconnected
         _hub.client.onChattingUserDisconnected = function () {
             playSound();
             PalPair.ConnectionManager.closeConnection();
             app.Views.Home.isBtnStartStopDisabled(false);
             app.Views.Home.chatStatus(app.Views.Home.pal().Name + ' is disconnected, looking for a new pal...');
             addSystemMessage(app.Views.Home.pal().Name + ' is disconnected, looking for a new pal...');
             disableChat();
             _hub.server.next().done(findFriend);
         }
         // On chattingUser Disconnected
         _hub.client.onChattingUserConnected = function (pal) {
             var otherVideo = document.querySelector('.video.partner');
             otherVideo.play();
             app.Views.Home.pal(pal);
             setDisplayToConnected();
         }
         _hub.client.addMessage = function (msg) {
             addMessage(app.Views.Home.pal().Name, msg)
         }
     },
    //$("#btnTest").click(function () {
    //    hub.server.test();
    //});
            _attachUiHandlers = function () {
                $("#btnStartStop").click(function () {
                    // start chat
                    if (app.Views.Home.btnStartStopValue() == "Start") {
                        _hub.server.connect().done(connect);
                    }
                        // stop chat
                    else {
                        setDisplayToStopped();
                        _hub.server.stop();
                    }
                });
                $('#btnSendMsg').click(function () {
                    if (app.Views.Home.txtMessage().length > 0) {
                        _hub.server.sendPrivateMessage(app.Views.Home.txtMessage()).done(addMessage(app.Views.Home.me().Name, app.Views.Home.txtMessage()));
                        app.Views.Home.txtMessage('');
                    }
                });
                $('#btnNext').click(function () {
                    PalPair.ConnectionManager.closeConnection();
                    _hub.server.next().done(findFriend);
                    setDisplayToLookingForFriend();
                });
                $("#txtMessage").keypress(function (e) {
                    if (e.which == 13 && app.Views.Home.isBtnSendMsgDisabled() == false) {
                        $('#btnSendMsg').click();
                    }
                });
            }
    // Connection Manager Callbacks
    _callbacks = {
        onReadyForStream: function (connection) {
            // The connection manager needs our stream
            // todo: not sure I like this
            connection.addStream(_mediaStream);
        },
        onStreamAdded: function (connection, event) {
            console.log('binding remote stream to the partner window');

            // Bind the remote stream to the partner window
            var otherVideo = document.querySelector('.video.partner');
            otherVideo.srcObject = event.stream; // from adapter.js
            otherVideo.play();
        },
        onStreamRemoved: function (connection, streamId) {
            // todo: proper stream removal.  right now we are only set up for one-on-one which is why this works.
            console.log('removing remote stream from partner window');
        }
    };
    function disableChat() {
        app.Views.Home.isBtnSendMsgDisabled(true);
        app.Views.Home.isBtnNextDisabled(true);
        app.Views.Home.pal(new User(""));
        stopVideo();
    }
    function enableChat() {
        app.Views.Home.isBtnSendMsgDisabled(false);
        app.Views.Home.isBtnNextDisabled(false);
    }
    function setDisplayToConnected() {
        playSound();
        addSystemMessage('Chatting with: ' + app.Views.Home.pal().Name);
        app.Views.Home.chatStatus('Chatting with: ' + app.Views.Home.pal().Name);
        enableChat();
    }
    function setDisplayToLookingForFriend() {
        app.Views.Home.isBtnSetFilterDisabled(true);
        app.Views.Home.chatStatus('Looking for a pal...');
        addSystemMessage('Looking for a pal...');
        app.Views.Home.btnStartStopValue("Stop");
        disableChat();
    }
    function setDisplayToStopped() {
        addSystemMessage('Stopped chatting.');
        PalPair.ConnectionManager.closeConnection();
        disableChat();
        app.Views.Home.chatStatus('Stopped.');
        app.Views.Home.btnStartStopValue("Start");
        app.Views.Home.isBtnSetFilterDisabled(false);
    }
    function connect(me) {
        if (me == null) {
            alert('You are already connected in another tab or browser.');
        }
        else {
            addSystemMessage('Started chatting.');
            setDisplayToLookingForFriend();
            _hub.server.start().done(findFriend);
        }
    }
    function findFriend(pal) {
        if (pal != null) {
            app.Views.Home.pal(pal);
            if (pal.Video == null) {
                $('#vidFriend').removeProp("loop");
                PalPair.ConnectionManager.initiateOffer(app.Views.Home.pal().ConnectionId, PalPair.Chat.getStream());
            }
            else {
                if (typeof adjustVideo === "function") {
                    adjustVideo();
                }
                $('#vidFriend')[0].src = pal.Video;
                $('#vidFriend').prop("loop", "loop");
                $('#vidFriend')[0].load();
                $('#vidFriend')[0].play();
            }
            setDisplayToConnected();
        }
        else {
            app.Views.Home.pal(new User(""));
        }
        app.Views.Home.btnStartStopValue("Stop");
    }
    function stopVideo() {
        // Clear out the partner window
        var otherVideo = document.querySelector('.video.partner');
        if (otherVideo.src != '') {
            otherVideo.src = '';
            otherVideo.pause();
        }
    }
    function addMessage(name, message, type) {
        if (_isChatActive == false)
            playSound();
        var d = new Date();
        $('#pnlChildChat').append('<div class="message"><span class="username">' + d.toLocaleTimeString() + ': ' + name + '</span>: ' + message + '</div>');
        $('#pnlChildChat')[0].scrollTop = $('#pnlChildChat')[0].scrollHeight;
        $('#pnlChat').removeClass('hidden');
    }
    function addSystemMessage(message) {
        if (_isChatActive == false)
            playSound();
        var d = new Date();
        $('#pnlChildChat').append('<div class="message system"><span class="username">' + d.toLocaleTimeString() + ': ' + '</span>: ' + message + '</div>');
        $('#pnlChildChat')[0].scrollTop = $('#pnlChildChat')[0].scrollHeight;
    }
    function playSound() {
        if ($('#chkSounds').prop('checked') == true) {
            var snd = new Audio("/Content/media/Windows Ding.wav"); // buffers automatically when created
            snd.play();
        }
    }
 
    function gotStream(stream) { // succcess callback gives us a media stream    
        $('.instructions').hide();
        // Store off the stream reference so we can share it later
        _mediaStream = stream;

        // Load the stream into a video element so it starts playing in the UI
        console.log('playing my local video feed');
        var videoElement = document.querySelector('.video.mine');
        videoElement.srcObject = _mediaStream;
        app.Views.Home.isBtnStartStopDisabled(false);
        app.Views.Home.loadingChat(false);
    }
    $(window).focus(function () {
        _isChatActive = true;
    });

    $(window).blur(function () {
        _isChatActive = false;
    });
    return {
        start: _start, // Starts the UI process
        getStream: function () { // Temp hack for the connection manager to reach back in here for a stream
            return _mediaStream;
        }
    };
})(PalPair.ViewModel, PalPair.ConnectionManager);

PalPair.Chat.start();