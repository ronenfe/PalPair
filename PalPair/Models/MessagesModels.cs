using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PalPair.Models
{
    public class Message
    {
        public Message(ApplicationUser user)
        {
            FromUserId = user.Id;
            ChatId = user.ChatId;
            DateSent = DateTime.Now;
        }
        [Required]
        [Key]
        public int MessageId { get; set; }
        public string FromUserId { get; set; }
        public string ToUserId { get; set; }
        [Required]
        public Guid ChatId { get; set; }
        public string Text { get; set; }
        [Required]
        public DateTime DateSent { get; set; }
    }
}