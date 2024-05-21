using PalPair.Models;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Web.Mvc;
using System.Web;
using Microsoft.AspNet.Identity;
using Microsoft.AspNet.Identity.Owin;
using System.Threading.Tasks;
using PalPair.DBContexts;


namespace PalPair.Controllers
{
    [Authorize]
    public class HomeController : Controller
    {
        public HomeController()
        {

        }
        private ApplicationUserManager _userManager
        {
            get
            {
                return HttpContext.GetOwinContext().GetUserManager<ApplicationUserManager>();
            }
        }
        public ActionResult Index()
        {
            FilterPal model = CreateFilter();
            return View(model);
        }
        private FilterPal CreateFilter()
        {
            FilterPal model = null;
            var user = _userManager.FindById(User.Identity.GetUserId());
            if (user.Filter != null)
            {
                model = user.Filter;
                if (user.Filter.Countries != null)
                    model.SelectedCountries = user.Filter.Countries.Split(',');
            }
            else
                model = new FilterPal();
            model.AllCountries = new MultiSelectList(GetCountries());
            return model;
        }
        [HttpPost]
        public ActionResult Index(FilterPal model)
        {
            var user = _userManager.FindById(User.Identity.GetUserId());
            if (user.Filter == null)
                user.Filter = new FilterPal();
            model.AllCountries = new MultiSelectList(GetCountries());
            user.Filter.IsFemaleFiltered = model.IsFemaleFiltered;
            user.Filter.IsMaleFiltered = model.IsMaleFiltered;
            if (model.SelectedCountries != null)
                user.Filter.Countries = String.Join(",", model.SelectedCountries);
            user.Filter.IsFilterOn = model.IsFilterOn;
            user.Filter.MinAge = model.MinAge;
            user.Filter.MaxAge = model.MaxAge;
            _userManager.Update(user);
            return View(model);
        }
        // GetCountries() method
        private IEnumerable<string> GetCountries()
        {
            return CultureInfo.GetCultures(CultureTypes.SpecificCultures)
                              .Select(x => new RegionInfo(x.LCID).EnglishName)
                              .Distinct()
                              .OrderBy(x => x);
        }
    }
}
