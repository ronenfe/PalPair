using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Web;

namespace PalPair.Models
{
    public class DictionaryEntry
    {
        [Required]
        [Key]
        public KeyNames Key { get; set; }
        public string Value { get; set; }
        [Required]
        public DateTime DateUpdated { get; set; }
    }

    public enum KeyNames
    {
        TopOnlineUsers,
    }
}