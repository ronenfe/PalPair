using PalPair.Models;
using System;
using System.Collections.Generic;
using System.Data.Entity;
using System.Linq;
using System.Web;

namespace PalPair.DBContexts
{
    public class PalPairContext : DbContext
    { 
        public DbSet<Message> Messages { get; set; }
        public DbSet<DictionaryEntry> DictionaryEntries { get; set; }
    }
}