using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;

namespace PalPair.Models
{
    // Models returned by MeController actions.
    public class GetViewModel
    {
        public string Name { get; set; }
        public Gender Gender { get; set; }
        public int Age { get; set; }
        public string City { get; set; }
        public string Country { get; set; }
        public string ConnectionId { get; set; }
        public string ChattingUserConnectionId { get; set; }
    }
}