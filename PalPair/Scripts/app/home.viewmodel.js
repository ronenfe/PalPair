function HomeViewModel(app, dataModel) {
    var self = this;
    self.pal = ko.observable(new User(""));
    self.connectedUsers = ko.observable("");
    self.txtMessage = ko.observable("");
    self.loadingChat = ko.observable(false);
    self.chatStatus = ko.observable("Stopped.");
    self.me = ko.observable(new User(""));
    self.isBtnStartStopDisabled = ko.observable(true);
    self.btnStartStopValue = ko.observable("Start");
    self.isBtnNextDisabled = ko.observable(true);
    self.isBtnSetFilterDisabled = ko.observable(false);
    self.isBtnSendMsgDisabled = ko.observable(true);
    self.chatHeight = $('#pnlBodyChat').height() + 'px';
    self.videoHeight = $('#pnlBodyChat').height()/2 + 'px';
    self.errorMessage = ko.observable({
        html : "<h4>Look Up or Down!</h4> Your browser should be asking you to enable your webcam and microphone.  <strong>This site will not work until you provide access</strong>.",
        css : "alert-warning"
    });
    self.toggleSettingsDiv = function() {
        $('#settingsDiv').toggleClass('hidden');
    }
    self.toggleChat = function () {
        $('#pnlChat').toggleClass('hidden');
    }
    //self.sizeChanged = function () {
    // change the size via DOM, outside knockoutjs
    //}
    //Sammy(function () {
    //    this.get('#home', function () {
    //        // Make a call to the protected Web API by passing in a Bearer Authorization Header
    //        $.ajax({
    //            method: 'get',
    //            url: app.dataModel.userInfoUrl,
    //            contentType: "application/json; charset=utf-8",
    //            headers: {
    //                'Authorization': 'Bearer ' + app.dataModel.getAccessToken()
    //            },
    //            success: function (data) {
    //                self.myCity('Your City is : ' + data.hometown);
    //            }
    //        });
    //    });
    //    this.get('/', function () { this.app.runRoute('get', '#home') });
    //});

    return self;
}
function User(name) {
    this.Name = name;
    this.Country = "";
    this.Age = "";
    this.City = "";
    this.Gender = "";
};
app.addViewModel({
    name: "Home",
    bindingMemberName: "home",
    factory: HomeViewModel
});
$(document).ready(function () {
    app.Views.Home.chatHeight = $('#pnlBodyChat').height() + 'px';
    app.Views.Home.videoHeight = $('#pnlBodyChat').height() / 2 + 'px';
});