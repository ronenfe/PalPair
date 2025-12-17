using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using Microsoft.AspNet.SignalR;
using PalPair.Models;
using Microsoft.AspNet.Identity;
using Microsoft.AspNet.Identity.EntityFramework;
using System.Threading;
using AIMLbot;
using System.Web.Mvc;
using Microsoft.AspNet.Identity.Owin;
using PalPair.DBContexts;
using NLog;
using System.Net.Http;
using System.Net.Http.Headers;
using Newtonsoft.Json;
using System.Threading.Tasks;

namespace PalPair.Hubs
{
    [Microsoft.AspNet.SignalR.Authorize]
    public class PalPairHub : Hub
    {
        #region Data Members
        private ApplicationUserManager _userManager
        {
            get
            {
                return HttpContext.Current.GetOwinContext().GetUserManager<ApplicationUserManager>();
            }
        }
        private static List<ApplicationUser> connectedUsers = InitializeBots();
        private Random rand = new Random();
        private static DictionaryEntry topConnectedUsers = GetTopConnectedUsers();
        private static readonly Logger logger = LogManager.GetCurrentClassLogger();
        private static List<ApplicationUser> InitializeBots()
        {
            List<ApplicationUser> connectedUsers = new List<ApplicationUser>();
            for (int i = 0; i < 5; i++)
            {
                string name = "";
                string country = "";
                string city = "";
                int age = 0;

                if (i % 5 == 0)
                {
                    name = "Jennifer";
                    country = "United States";
                    city = "New York";
                    age = 36;
                }
                else if (i % 4 == 0)
                {
                    name = "Alice";
                    country = "United Kingdom";
                    city = "London";
                    age = 22;
                }
                else if ( i % 3 == 0)
                {
                    name = "Dana";
                    country = "Ireland";
                    city = "Dublin";
                    age = 24;
                }
                else if ( i % 2 == 0)
                {
                    name = "Anna";
                    country = "Ukraine";
                    city = "Kiev";
                    age = 35;
                }
                else
                {
                    name = "Darma";
                    country = "Indonesia";
                    city = "Jakarta";
                    age = 25;
                }
                ApplicationUser user = new ApplicationUser()
                {
                    Name = name,
                    Email = name + i + "@palpair.com",
                    Country = country,
                    City = city,
                    Age = age,
                    Gender = Gender.Female,
                    Video = "Content/Media/" + name + ".mp4",
                    UserName = name + i,
                    ConnectionId = Guid.NewGuid().ToString()
                };
                Bot myBot = new Bot(HttpContext.Current.Server.MapPath("~/App_Data"));
                myBot.loadSettings();
                myBot.loadAIMLFromFiles();
                myBot.GlobalSettings.updateSetting("name", user.Name);
                myBot.GlobalSettings.updateSetting("age", user.Age.ToString());
                myBot.GlobalSettings.updateSetting("location", user.Country +", " + user.City);
                myBot.GlobalSettings.updateSetting("gender", user.Gender.ToString());
                myBot.isAcceptingUserInput = true;
                user.Bot = myBot;
                connectedUsers.Add(user);
            }
            return connectedUsers;
        }
        #endregion
        #region Methods
        public ChatUser Start()
        {
            // user connects
            var user = GetCurrentConnectedUser();   
            ApplicationUser chattingUser = null;
            if (user.Email.EndsWith(".bot"))
            {
                chattingUser = null;
                Bot myBot = new Bot(HttpContext.Current.Server.MapPath("~/App_Data"));
                myBot.loadSettings();
                myBot.loadAIMLFromFiles();
                myBot.isAcceptingUserInput = true;
                myBot.GlobalSettings.updateSetting("name", user.Name);
                myBot.GlobalSettings.updateSetting("age", user.Age.ToString());
                myBot.GlobalSettings.updateSetting("location", user.Country +", " + user.City);
                myBot.GlobalSettings.updateSetting("gender", user.Gender.ToString());
                user.Bot = myBot;
            }
            else
            {
                  var  matchingUsers = connectedUsers.Where(cu => cu.UserName != user.UserName &&  String.IsNullOrEmpty(cu.ChattingUserConnectionId));
                  if (matchingUsers != null && matchingUsers.Count() > 0)
                  {
                      matchingUsers = FilterMatchingUsers(user, matchingUsers);
                      if (matchingUsers != null && matchingUsers.Count() > 0)
                        chattingUser = matchingUsers.ElementAt(rand.Next(matchingUsers.Count()));
                  }

            }
            if (chattingUser != null)
            {
                MatchFound(user, chattingUser);
            }
            UpdateConnectedUsers();
            return chattingUser == null ? null : new ChatUser(chattingUser);
        }

        private static IEnumerable<ApplicationUser> FilterMatchingUsers(ApplicationUser user, IEnumerable<ApplicationUser> matchingUsers)
        {
            // filter matches
            if (user.Filter != null && user.Filter.IsFilterOn)
            {
                logger.Info("Filter is on for user: " + user.Id);
                matchingUsers = matchingUsers.Where(mu => mu.Age >= user.Filter.MinAge && mu.Age <= user.Filter.MaxAge && user.Filter.Countries != null && user.Filter.Countries.Contains(mu.Country) && (mu.Gender == Gender.Male && user.Filter.IsMaleFiltered || mu.Gender == Gender.Female && user.Filter.IsFemaleFiltered));
            }
            matchingUsers = matchingUsers.Where(mu => mu.Filter == null || (mu.Filter != null && ( mu.Filter.IsFilterOn == false || (mu.Filter.IsFilterOn == true && user.Age >= mu.Filter.MinAge && user.Age <= mu.Filter.MaxAge && mu.Filter.Countries.Contains(user.Country) && (user.Gender == Gender.Male && mu.Filter.IsMaleFiltered || user.Gender == Gender.Female && mu.Filter.IsFemaleFiltered)))));
            return matchingUsers;
        }
        private static DictionaryEntry GetTopConnectedUsers()
        {
            DictionaryEntry entry = null;
            using (var dbContext = new PalPairContext())
            {
                entry = dbContext.DictionaryEntries.FirstOrDefault(de => de.Key == KeyNames.TopOnlineUsers);
            }
            return entry;
        }
        private void UpdateConnectedUsers()
        {
            if (connectedUsers.Count > int.Parse(topConnectedUsers.Value))
            {
                using (var dbContext = new PalPairContext())
                {
                    topConnectedUsers.Value = connectedUsers.Count.ToString();
                    topConnectedUsers.DateUpdated = DateTime.Now;
                    dbContext.DictionaryEntries.Attach(topConnectedUsers);
                    var entry = dbContext.Entry(topConnectedUsers);
                    entry.Property(e => e.Value).IsModified = true;
                    entry.Property(e => e.DateUpdated).IsModified = true;
                    dbContext.SaveChanges();
                }
            }
            Clients.All.updateConnectedUsers(connectedUsers.Count, connectedUsers.Count(cu=> cu.Gender == Gender.Male));
        }

        private void MatchFound(ApplicationUser user, ApplicationUser chattingUser)
        {
                if (chattingUser.Bot != null)
                {
                    UpdateBotSettings(user, chattingUser.Bot);
                }
                user.ChattingUserConnectionId = chattingUser.ConnectionId;
                chattingUser.ChattingUserConnectionId = user.ConnectionId;
                // real person
                if (chattingUser.Video == null)
                {
                    Clients.Client(user.ChattingUserConnectionId).onChattingUserConnected(new ChatUser(user));
                }
                logger.Info("User: " + user.Id + " found a match with: user" + chattingUser.Id);
                Guid guid = Guid.NewGuid();
                user.ChatId = guid;
                chattingUser.ChatId = guid;
        }

        private static void UpdateBotSettings(ApplicationUser user, Bot bot)
        {
            bot.DefaultPredicates.updateSetting("name", user.Name);
            bot.DefaultPredicates.updateSetting("age", user.Age.ToString());
            bot.DefaultPredicates.updateSetting("location", user.Country + ", " + user.City);
            bot.DefaultPredicates.updateSetting("gender", user.Gender.ToString());
        }
        public ChatUser Next()
        {
            var user = GetCurrentConnectedUser();
            logger.Info("User: " + user.Id + " clicked next.");
            var matchingUsers = connectedUsers.Where(cu => cu.UserName != user.UserName && String.IsNullOrEmpty(cu.ChattingUserConnectionId));
            ApplicationUser chattingUser = null;
            if (matchingUsers != null && matchingUsers.Count() > 0)
            {
                matchingUsers = FilterMatchingUsers(user, matchingUsers);
                if (matchingUsers != null && matchingUsers.Count() > 0)
                    chattingUser = matchingUsers.ElementAt(rand.Next(matchingUsers.Count()));
            }
            DisconnectChattingUser(user);
            if (chattingUser != null)
            {
                MatchFound(user, chattingUser);
            }
            return chattingUser == null ? null : new ChatUser(chattingUser);
        }
        public async Task<ApplicationUser> Connect()
        {
            var user = await GetCurrentUserAsync();
            if (connectedUsers.Exists(u => u.Email == user.Email))
                return null;
            user.ConnectionId = Context.ConnectionId;
            user.ChattingUserConnectionId = null;
            connectedUsers.Add(user);
            logger.Info("Connecting User: " + user.Id);
            return user;
        }

        public void GetNumberOfConnectedUsers()
        {
            logger.Info("GetNumberOfConnectedUsers" + connectedUsers.Count);
            UpdateConnectedUsers();
        }
        public void Stop()
        {
            var user = GetCurrentConnectedUser();

            if (user != null)
            {
                if (!String.IsNullOrEmpty(user.ChattingUserConnectionId))
                {
                    DisconnectChattingUser(user);
                }
                Clients.Client(user.ConnectionId).onUserDisconnected();
                connectedUsers.Remove(user);
                UpdateConnectedUsers();
                logger.Info("Disconnecting User: " + user.Id);
            }

        }
        public async Task<ChatUser> GetMyUserDetails()
        {
            var user = await GetCurrentUserAsync();
            return new ChatUser(user);
        }
        public void Test()
        {
            //    Clients.All.test();
        }
        private void DisconnectChattingUser(ApplicationUser user)
        {
            var chattingUser = connectedUsers.SingleOrDefault(cu => cu.ConnectionId == user.ChattingUserConnectionId);
            if (chattingUser != null)
            {
                logger.Info("Disconnecting User: " + chattingUser.Id + " from user: " + user.Id);
                Clients.Client(chattingUser.ConnectionId).onChattingUserDisconnected();
                chattingUser.ChattingUserConnectionId = null;
                user.ChattingUserConnectionId = null;
                user.PandoraBotSessionId = null;
            }
        }
        public void SendPrivateMessage(string message)
        {
            var user = GetCurrentConnectedUser();
            if (user != null && !String.IsNullOrEmpty(user.ChattingUserConnectionId))
            {
                var chattingUser = connectedUsers.SingleOrDefault(cu => cu.ConnectionId == user.ChattingUserConnectionId);
                // send to receiver user
                if (chattingUser != null)
                {
                    if (chattingUser.Email.EndsWith(".bot") || chattingUser.Video != null)
                    {
                        Thread myNewThread = new Thread(() => SendBotReply(message, user, chattingUser));
                        myNewThread.Start();
                    }
                    using (var dbContext = new PalPairContext())
                    {
                        dbContext.Messages.Add(new Message(user)
                        {
                            Text = message,
                            ToUserId = chattingUser.Id,
                        });
                        dbContext.SaveChanges();
                    }
                    Clients.Client(chattingUser.ConnectionId).addMessage(message);
                }

            }

        }
        private void SendBotReply(string message, ApplicationUser user, ApplicationUser chattingUser)
        {
            string answer = "";

            if (chattingUser.BotUser == null)
                chattingUser.BotUser = new User(user.Email, chattingUser.Bot);
            //true if it all chars are not letters
            bool result = message.All(x => !char.IsLetter(x));
            if (result == false)
            {
                Request req = new Request(message, chattingUser.BotUser, chattingUser.Bot);
                Result res = chattingUser.Bot.Chat(req);
                answer = res.Output;
            }
            else
            {
                answer = "?";
            }
            Thread.Sleep(Math.Min(300 * answer.Length, 2000));
            // HTTP POST
            //using (var client = new HttpClient())
            //{
            //    client.BaseAddress = new Uri("http://aiaas.pandorabots.com");
            //    client.DefaultRequestHeaders.Accept.Clear();
            //    client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
            //    string request = "talk/1409612863220/rosey?user_key=619c2bcad5c273d04b7ff25aa8b059e3&input=" + HttpUtility.UrlEncode(message);
            //    if (chattingUser.PandoraBotSessionId != null)
            //        request += "&sessionid=" + chattingUser.PandoraBotSessionId;
            //    HttpResponseMessage response = await client.PostAsJsonAsync(request,"");
            //    var result = response.Content.ReadAsStringAsync().Result;
            //    if (response.IsSuccessStatusCode)
            //    {
            //        dynamic data = JsonConvert.DeserializeObject(result);
            //        answer = data.responses[0];
            //        chattingUser.PandoraBotSessionId = data.sessionid;
            //    }
            //}
            //Thread.Sleep(Math.Min(400 * answer.Length, 2000));
            Clients.Client(user.ConnectionId).addMessage(answer);
            if (chattingUser.Email.EndsWith(".bot"))
                Clients.Client(chattingUser.ConnectionId).addMessage("####I answered:#####" + answer);
        }
        public override System.Threading.Tasks.Task OnDisconnected(bool stopCalled)
        {
            Stop();
            return base.OnDisconnected(false);
        }
        // WebRTC Signal Handler
        public void SendSignal(string signal, string targetConnectionId)
        {
            ApplicationUser fromUser = connectedUsers.SingleOrDefault(cu => cu.ConnectionId == Context.ConnectionId);
            // These folks are in a call together, let's let em talk WebRTC
            if (fromUser != null)
            { 
                var chattingUser = connectedUsers.SingleOrDefault(cu => cu.ConnectionId == fromUser.ChattingUserConnectionId);
                if (chattingUser != null)
                {
                    logger.Info("Sending signal: " + signal + " from user: " + fromUser.Id + "to user: " + chattingUser.Id);
                    Clients.Client(targetConnectionId).receiveSignal(new ChatUser(fromUser), signal);
                }
            }
        }
        #endregion
        #region Private Helpers
        private ApplicationUser GetCurrentConnectedUser()
        {
            return connectedUsers.SingleOrDefault(cu => cu.ConnectionId == Context.ConnectionId);
        }
        private async Task<ApplicationUser> GetCurrentUserAsync()
        {
            // Use HttpContext.Current.GetOwinContext() to get the OWIN context in ASP.NET 4.8
            var userManager = HttpContext.Current.GetOwinContext().GetUserManager<ApplicationUserManager>();

            // Get the current user's username from the authenticated identity
            var userName = Context.User.Identity.GetUserName();

            // Use FindByNameAsync to find the user by username asynchronously
            var user = await userManager.FindByNameAsync(userName);

            // Log the user's filter if available
            if (user?.Filter != null)
            {
                logger.Info("Filter of user: " + user.Name + " is " + user.Filter.IsFilterOn);
            }

            return user;
        }
        #endregion
    }
}