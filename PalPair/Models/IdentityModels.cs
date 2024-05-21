using System.Data.Entity;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNet.Identity;
using Microsoft.AspNet.Identity.EntityFramework;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using AIMLbot;
using System;
using System.ComponentModel;
using System.Web.Mvc;

namespace PalPair.Models
{
    // You can add profile data for the user by adding more properties to your ApplicationUser class, please visit http://go.microsoft.com/fwlink/?LinkID=317594 to learn more.
    public class ApplicationUser : IdentityUser
    {
        [Required]
        public string Name { get; set; }
        [Required]
        public Gender Gender { get; set; }
        [Required]
        public int Age { get; set; }
        [Required]
        public string City { get; set; }
        [Required]
        public string Country { get; set; }
        public int? FilterId { get; set; }
        [ForeignKey("FilterId")]
        public virtual FilterPal Filter { get; set; }
        [NotMapped]
        public string ConnectionId { get; set; }
        [NotMapped]
        public string ChattingUserConnectionId { get; set; }
        [NotMapped]
        public int? PandoraBotSessionId { get; set; }
        [NotMapped]
        public User BotUser { get; set; }
        [NotMapped]
        public Bot Bot { get; set; }
        [NotMapped]
        public string Video { get; set; }
        [NotMapped]
        public Guid ChatId { get; set; }
        public ApplicationUser()
        {
            Age = 18;
        }

        public async Task<ClaimsIdentity> GenerateUserIdentityAsync(UserManager<ApplicationUser> manager)
        {
            // Note the authenticationType must match the one defined in CookieAuthenticationOptions.AuthenticationType
            var userIdentity = await manager.CreateIdentityAsync(this, DefaultAuthenticationTypes.ApplicationCookie);
            // Add custom user claims here
            return userIdentity;
        }
    }

    public class FilterPal
    {
        public FilterPal()
        {
            MinAge = 18;
            MaxAge = 30;
        }
        // Contains the list of countries.
        [NotMapped]
        public System.Web.Mvc.MultiSelectList AllCountries { get; set; }
        [NotMapped]
        public string[] SelectedCountries { get; set; }
        [Key]
        public int Id { get; set; }

        public bool IsFilterOn { get; set; }

        public bool IsMaleFiltered { get; set; }
        public bool IsFemaleFiltered { get; set; }

        [Display(Name = "MinAge")]
        public int MinAge { get; set; }
        [Display(Name = "MaxAge")]
        public int MaxAge { get; set; }

        [Display(Name = "Countries")]
        public string Countries { get; set; }
    }

    public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
    {
        public ApplicationDbContext()
            : base("DefaultConnection", throwIfV1Schema: false)
        {
        }
        public DbSet<FilterPal> Filters { get; set; }
        public static ApplicationDbContext Create()
        {
            return new ApplicationDbContext();
        }
    }
    public class ChatUser
    {
        public string Name { get; set; }
        public string ConnectionId { get; set; }
        public string Country { get; set; }
        public string City { get; set; }
        public int Age { get; set; }
        public string Gender { get; set; }
        public string Video { get; set; }
        private ChatUser()
        {
        }
        public ChatUser(ApplicationUser user)
        {
            Name = user.Name;
            ConnectionId = user.ConnectionId;
            Age = user.Age;
            Country = user.Country;
            City = user.City;
            Gender = user.Gender.ToString();
            Video = user.Video;
        }
    }
    public enum Gender
    {
        Male,
        Female
    }
}