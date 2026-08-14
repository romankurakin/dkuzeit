function n2str(nr)
{
	var str = nr.toString();
	while (str.length < 5) str = "0" + str;
	return(str);
}

function getParameter(url, name)
{
  var qm_idx = url.indexOf("?");
  if (qm_idx > -1 )
  {
    var parameterstrings = url.substr(qm_idx).split("&");
    for ( var i = 0; i < parameterstrings.length; i++ )
    {
       var str = parameterstrings[i];
      if (str.indexOf(name + "=") > -1 )
	{
        var paramSplit = str.split("=");
        return(paramSplit[1]);
      }
    }
  }
  return "";
}

function IsLeapYear(year)
{
 var leap = (((year % 4) == 0) && (((year % 100) != 0) || ((year % 400) ==0 )));
 if (leap) 
	return 1;
 else
    return 0;
}

var monthdays = new Array(31,28,31,30,31,30,31,31,30,31,30,31);

function DayOfYear(mydate)
{
 var year = mydate.getFullYear();
 monthdays[1] = IsLeapYear(year) + 28;
 var days = mydate.getDate();
 for (var i=0; i < mydate.getMonth(); i++)
 {
	days += monthdays[i];
 } 
 return(days); 
}

/**
* Returns the week number for this date. 
* the week returned is the ISO 8601 week number.
* source: http://techblog.procurios.nl/k/news/view/33796/14863/calculate-iso-8601-week-and-year-in-javascript.html
* @return int
*/
Date.prototype.getWeek = function () {
    // Create a copy of this date object  
    var target = new Date(this.valueOf());

    // ISO week date weeks start on monday  
    // so correct the day number  
    var dayNr = (this.getDay() + 6) % 7;

    // ISO 8601 states that week 1 is the week  
    // with the first thursday of that year.  
    // Set the target date to the thursday in the target week  
    target.setDate(target.getDate() - dayNr + 3);

    // Store the millisecond value of the target date  
    var firstThursday = target.valueOf();

    // Set the target to the first thursday of the year  
    // First set the target to january first  
    target.setMonth(0, 1);
    // Not a thursday? Correct the date to the next thursday  
    if (target.getDay() != 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }

    // The weeknumber is the number of weeks between the   
    // first thursday of the year and the thursday in the target week  
    return 1 + Math.ceil((firstThursday - target) / 604800000); // 604800000 = 7 * 24 * 3600 * 1000  
};

function WeekOfYear(mydate)
{
 var w = mydate.getWeek();
 return(w);
}

function doDisplayTimetable(Form, topDir) {
    if (Form.element.selectedIndex < 0)
        return;
    var week = Form.week[Form.week.selectedIndex].value;
    var type = Form.type[Form.type.selectedIndex].value;
    var FileName = type + n2str(Form.element[Form.element.selectedIndex].value) + ".htm";
    var url;
    if (topDir == "w")
        url =  week + "/" + type + "/" + FileName;
    else
        url =  type + "/" + week + "/" + FileName;
    //parent.main.location = url; In Firefox it is not allowed to just set the location (CORS issue)
    //Instead use postMessage to tell the parent that it should change its location
    parent.postMessage(url, '*');
}

var selclassContent;
function setselclass(cmd)
{
	var el = document.getElementById("selclassid");
/*
	if (cmd == "save")
        selclassContent = el.innerHTML ;
	else if (cmd == "empty")
        el.innerHTML  = "";
	else if (cmd == "restore")
        el.innerHTML  = selclassContent;
*/
    if (el != null)
    {
	    if (cmd == "empty")
           el.disabled = true;        
	    else if (cmd == "restore")
           el.disabled = false;        
    }
} 
