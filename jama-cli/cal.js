#!/usr/bin/env node
// cal.js


// calendar - generate a HTML page with a calendar on it.
//
// Usage:
// <script type="text/javascript" src="cal.js"></script>
//
// .. x = calendar(URL);
// .. replace innerHTML of something with x
//
// URL must be a file ending in .calin, containing lines
//    *                     comment
//    month num             Print calendar for the Nth month (1-12)
//    year num              Print calendar for a year other than current
//    title restofline      Page title
//    head restofline       Any number of these, precede calendar
//    foot restofline       Any number of these, follow calendar
//    mm/dd/yy text         Put "text" in the box for dd if it's mm in yy
//    mm/dd text            Put "text" in the box for dd if it's mm
//    class mm/dd cls       Assign class "cls" to the box for mm/dd
//    every thursday[+1] [in Nov] text
//    first thursday[+1] in Nov text
//    .. second, third, fourth, fifth, last ..
//    include filename      Process filename as input (holidays etc)
//    boxwidth nn
//    boxheight nn
//
// output is
// -- a DIV (class "calendar") containing
// -- an H1 [set by "title" verb]
// -- a heading (class "head") [set by "head" verb]
// -- an H2 [containing "month year"]
// -- a table
// ---- a heading row of boxes (class "headbox") with day names
// ---- 4 to 6 rows of boxes (class "rowN colM")
// ------ unused boxes (class "unused")
// ------ used boxes (class "box") 
// -------- day number (class "daynum")
// -------- text (class "boxcontent") [set by multiple verbs]
// -- a footer (class "foot") [set by "foot" verb]
//
// CSS selectors and example content
// -- .calendar {font-family: Arial,Helvetica,Sans-serif;}
// -- .calendar H1 {text-align: center;}
// -- .calendar H2 {text-align: center;}
// -- .calendar .head {font-size: 80%;}
// -- .calendar TABLE {border: 2px solid black; background: white;  border-collapse: collapse;}
// -- .calendar TABLE tr {border: 1px solid black; vertical-align: top;}
// -- .calendar TABLE th {border: 2px solid black; background: white;}
// -- .calendar TABLE td {border: 1px solid black; background: white; width: 115px;}
// -- .calendar TABLE .headbox {background-color: pink; color: black;}
// -- .calendar TABLE .boxcontent {font-size: 70%;}
// -- .calendar TABLE .boxcontent .col1 {background-color: yellow;} /* show Sunday in yellow */
// -- .calendar TABLE .boxcontent .col7 {background-color: yellow;} /* show Saturday in yellow */
// -- .calendar TABLE .daynumber {font-family: monospace; font-weight: bold; font-size: 120%;}
// -- .calendar TABLE .unused {background: #cccccc;}
// -- .calendar .foot {font-size: 70%;}
//
// THVV 01/98 initial .. Perl version, not derived from my 1981 FORTRAN version or 1974 Multics PL/I version
// THVV 01/17/98 v2   .. fix up year handling
// THVV 04/04/02 v3   .. styles
// THVV 02/29/08 v3   .. center
// THVV 05/09/11 v4   .. bug fixes, move more formatting into CSS
// THVV 02/27/12 v5   .. bug fix for leap year
// THVV 05/01/12 v5   .. bug fix for "every wed monoplane"
// THVV 12/02/16 initial -- a pedestrian translation of the Perl version cal.cgi into Javascript, with few changes
//
// to do: validate the numbers in dates
// Copyright (c) Tom Van Vleck, 2016

/* Permission is hereby granted, free of charge, to any person obtaining
   a copy of this software and associated documentation files (the
   "Software"), to deal in the Software without restriction, including
   without limitation the rights to use, copy, modify, merge, publish,
   distribute, sublicense, and/or sell copies of the Software, and to
   permit persons to whom the Software is furnished to do so, subject to
   the following conditions:
   
   The above copyright notice and this permission notice shall be included
   in all copies or substantial portions of the Software.
   
   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
   EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
   MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
   IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
   CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
   TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
   SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. 
 */

// ----------------------------------------------------------------
// read in a whole file specified by URL
// URL should be relative, no http: or anything, because of same-origin security
// BUG: this writes a message to the console saying "syntax error" and/or "not well formed" (because the file is not XML) .. but it works anyway.
function readfile(u) {
    var funval = "";
    if (u.substring(u.length-6) == ".calin") { // this is so the calendar function cannot be used fo poke around in your files
	//alert("reading "+u);
	var xhr = window.XMLHttpRequest ? new XMLHttpRequest() : new ActiveXObject("Microsoft.XMLHTTP");
	xhr.onreadystatechange = function () {
            if (xhr.readyState == 4) {
		funval = xhr.responseText;
            }
	}
	// fire the open
	xhr.open("GET", u, false); // synchronous.  this may be deprecated but these files are so tiny it makes no difference
	xhr.send();
    }
    return funval;
} // readfile

// ----------------------------------------------------------------
// return a calendar formatted in HTML
function calendar(filename) {
    //constants
    var GGmoname = ["January","February","March","April","May","June","July","August","September","October","November","December"]; // future .. i18n
    var GGdaysmo = [31,28,31,30,31,30,31,31,30,31,30,31,31];

    // parameters
    var unusedclass = "unused";    // light gray

    var rightnow = new Date(); // new Date(year, month [, day, hours, minutes, seconds, ms])

    // define a Javascript object for the calendar page
    var calPage = {
	year: rightnow.getFullYear(), // year for this page
	month: rightnow.getMonth(),   // month for this page
	title: "",		      // title for this page, or blank
	head: "",		      // heading text for this page, NL separated, or blank
	foot: "",		      // footer text for this page, NL separated, or blank
	boxheight: 4,		      // standard height for all boxes
	boxwidth: 14,		      // standard width for all boxes
	boxlines: [],		      // array, number of text lines in each day's box
	boxtext: [],		      // array, text lines for the box, <br> separated
	boxclass: []		      // array, CSS class for this box, or blank
    };
    for (i=0; i <= 31; i++) {	// initialize the per-box arrays
    	calPage.boxlines[i] = 0;
    	calPage.boxtext[i] = "";
    	calPage.boxclass[i] = "";
    }

    // switches and initial values
    var output = "";                // calendar output

    if (filename != "") {
	procfile (filename, calPage);
    }

    // month and year may have been changed while reading the input.
    var bom = new Date(calPage.year, calPage.month, 1, 0, 0, 0, 0); // begin of month
    var mday = bom.getDate();
    var wday = bom.getDay();

    var lastday;
    var dayno;

    lastday = GGdaysmo[calPage.month];
    if (((calPage.year%4) == 0) && calPage.month == 1)  { // leap year
	lastday++;
    }
    dayno = ((mday-wday+12) % 7)-5; // 1 if month begins on Sun .. -5 if Sat

    output += "<div class=\"calendar\">\n";
    if (calPage.title != "") {
	output += "<h1>" + calPage.title + "</h1>\n\n";
    }
    output += "<span class=\"head\">\n" + calPage.head + "</span>\n"
    output += "<h2>" + GGmoname[calPage.month] + " " + calPage.year + "</h2>\n\n";

    // set up table and column heads
    output += "<table summary=\"calendar\">\n";
    output += "<tr>";
    output += "<th class=\"headbox\">Sunday</th>"; // future.. i18n
    output += "<th class=\"headbox\">Monday</th>";
    output += "<th class=\"headbox\">Tuesday</th>";
    output += "<th class=\"headbox\">Wednesday</th>";
    output += "<th class=\"headbox\">Thursday</th>";
    output += "<th class=\"headbox\">Friday</th>";
    output += "<th class=\"headbox\">Saturday</th>";
    output += "</tr>\n\n";

    var row, col;
    // output the calendar rows
    for (row=0; ((row < 6) && (dayno <= lastday)); row++) {
	output += "<tr>\n";
	var rowpadded = 0;
	for (col=0; col < 7; col++) {
	    var tclass = "row"+(row+1) + " " + "col"+(col+1);
            if ((dayno > 0) && (dayno <= lastday)) {
		output += "<td class=\"box "+tclass;
		if (calPage.boxclass[dayno] != "") {
                    output += " " + calPage.boxclass[dayno];
		}
		output += "\">\n";
		// put the day number in the first row
		x1 = rjust_number(dayno, calPage.boxwidth); // pad to width
		output += "<span class=\"daynumber\">" + x1 + "</span>\n"; // force box width
		// print box contents if any
		if (rowpadded == 0 || calPage.boxtext[dayno] != "") {
                    output += "<span class=\"boxcontent\">\n";
                    if (calPage.boxtext[dayno] == "") {
			output += "<br>";
                    }
                    for (j=calPage.boxlines[dayno]; j<calPage.boxheight; j++) {
			output += "<br>"; // all rows same min height, pad the rest
                    }
		    if (calPage.boxtext[dayno] != "") {
			output += calPage.boxtext[dayno]; // has calPage.boxlines[dayno] lines in it
		    }
                    output += "</span>\n";
                    rowpadded = 1;
		}
            } else {
		output += "<td class=\"unused\">&nbsp;\n";
            }
            dayno++;
            output += "</td>\n";
	} // for col
	output += "</tr>\n\n";
    } // for row

    // finish table and output += footer
    output += "</table>\n\n";
    output += "<span class=\"foot\">\n" + calPage.foot + "</span>\n"
    output += "</div>\n";

    return output;                  // caller will replace the innerHTML of something with this string
} // calendar

// ================================================================

// process one input file
function procfile (inputfile, theCalPage) {

    if (inputfile == "") {
	return;
    }
    var filecontent = readfile(inputfile); // read whole URL
    if (filecontent == "") {
	return;
    }
    var lines = [];
    lines = filecontent.split("\n");	 // split into lines

    var lineno = 0;
    while (lineno < lines.length) {
	var re0 = /^([^ ]*) +(.*)$/;
	var cmd, rest;
	var result = re0.exec(lines[lineno]); // line into command and rest
	if (result == null) {
	    cmd = "";
	    rest = "";
	} else {
	    cmd = result[1];
	    rest = result[2];
	}

	//alert("cmd="+cmd);
	
        if (cmd == "*") {}     // comment
        else if (cmd == "") {}
        else if (cmd == "title") {
            theCalPage.title = rest;
        } else if (cmd == "boxwidth") {
            theCalPage.boxwidth = rest;
        } else if (cmd == "boxheight") {
            theCalPage.boxheight = rest;
        } else if (cmd == "month") {
            if (rest == "next") {
                theCalPage.month += 1;
            } else if (rest == "+1") {
                theCalPage.month += 1;
            } else if (rest == "-1") {
                theCalPage.month -= 1;
            } else if (rest == "prev") {
                theCalPage.month -= 1;
            } else {
		var m = parseInt(rest);
		if (m != NaN) {
                    theCalPage.month = rest-1; // 0-11
		}
            }
	    if (theCalPage.month < 0) {
		theCalPage.month = 11;
		theCalPage.year -= 1;
	    } else if (theCalPage.month > 11) {
		theCalPage.month = 0;
		theCalPage.year += 1;
	    }
        } else if (cmd == "year") {
            if (rest == "next") {
                theCalPage.year += 1;
            } else if (rest == "+1") {
                theCalPage.year += 1;
            } else if (rest == "-1") {
                theCalPage.year -= 1;
            } else if (rest == "prev") {
                theCalPage.year -= 1;
            } else {
		var y = parseInt(rest);
		if (y != NaN) {
                    theCalPage.year = rest;
		}
            }
            if (theCalPage.year < 0) {
		// leave year alone
            } else if (theCalPage.year < 50) {
		theCalPage.year += 2000;
	    } else if (theCalPage.year < 100) {
		theCalPage.year += 1900;
	    }
        } else if (cmd == "head") {
            theCalPage.head += " " + rest;
        } else if (cmd == "foot") {
            theCalPage.foot += " " + rest;
        } else if (cmd.indexOf("/") >= 0) { // a date
            var m, d, y;
	    var v = cmd.split("/");
	    m = parseInt(v[0]);
	    d = parseInt(v[1]);
	    if ((theCalPage.month+1 == m) && (d != NaN)) { // ignore if wrong month
		if (typeof(v[2]) != "undefined") { // is year specified?
		    y = v[2];
		    if (y < 50) { // fix year if it is two digit
			y += 2000;
		    } else if (y < 100) {
			y += 1900;
		    }
		    if (theCalPage.year == y) { // does year match?
			addtobox(theCalPage, d, rest);
		    }
		} else {
		    addtobox(theCalPage, d, rest);
 		}
	    }
       } else if (cmd == "class") { // class mm/dd/yy important
            var date, c, m, d, y;
	    var re3 = /^([^ ]*) +(.*)$/;
	    var result = re3.exec(rest);
	    if (result != null) {
		date = result[1];
		c = result[2];
		var v = date.split("/");
		m = parseInt(v[0]);
		d = parseInt(v[1]);
		if ((theCalPage.month+1 == m) && (d != NaN)) { // ignore if wrong month
		    if (typeof(v[2]) != "undefined") { // is year specified?
			y = v[2];
			if (y < 50) { // fix year if it is two digit
			    y += 2000;
			} else if (y < 100) {
			    y += 1900;
			}
			if (theCalPage.year == y) { // does year match?
			    theCalPage.class[d] = c;
			}
		    } else {
			theCalPage.class[d] = c; // didn't specify year
		    }
		}
	    } else {		// could not find class name
		alert("cannot parse :"+lines[lineno]);
	    }
        } else if (cmd == "first") { // first thursday[+1] in Nov text
            weekday(1, rest, lines[lineno], theCalPage);
        } else if (cmd == "second") { // second thursday[+1] in Nov text
            weekday(2, rest, lines[lineno], theCalPage);
        } else if (cmd == "third") { // third thursday[+1] in Nov text
            weekday(3, rest, lines[lineno], theCalPage);
        } else if (cmd == "fourth") { // fourth thursday[+1] in Nov text
            weekday(4, rest, lines[lineno], theCalPage);
        } else if (cmd == "fifth") { // fifth thursday[+1] in Nov text
            weekday(5, rest, lines[lineno], theCalPage);
        } else if (cmd == "last") { // last thursday[+1] in Nov text
            weekday(-1, rest, lines[lineno], theCalPage);
        } else if (cmd == "every") { // every thursday[+1] in Nov text
            weekday(0, rest, lines[lineno], theCalPage);
        } else if (cmd == "include") {
            procfile(rest, theCalPage);
        } else {
            alert("cal.js: unknown command: " + cmd);
        }
	lineno++;
    } //while
} //procfile

// ----------------------------------------------------------------
// addtobox (number, width)
function addtobox(theCalPage, d, text) { // ravel into a box
    theCalPage.boxtext[d] += "<br>" + text;
    theCalPage.boxlines[d]++;
    //alert("added to "+d+": "+text);
} // addtobox

// ----------------------------------------------------------------
// val = rjust_number (number, width)
function rjust_number(x, y) { // returns number right justified
    var z = "                                "+x;
    var zz = z.substring(z.length-y, z.length);
    return zz.replace(/ /g, "&nbsp;");
} // rjust_number

// ----------------------------------------------------------------
// processing for "every", "first", ...
//  weekday(nth, rest, line, calPage)
//   where nth is  1-5, or -1 for last, or 0 for all
//   and   rest is "thursday[+1] in april messagemessage"
function weekday(WDnth, WDrol, WDline, WDcalpage) {
    var offset = 0;             // default is no offset
    var m = WDcalpage.month;	// default is this month
    var dow = -1;               // must specify dow
    var content = "..";
    var rol1, word, x, y, tnth, lastday, d;
    // constants
    var GGshortdayname = [];
    var GGmonthname = [];
    var GGdaysmo = [31,28,31,30,31,30,31,31,30,31,30,31,31]; // need this twice
    GGshortdayname["sun"] = 0; // create object members
    GGshortdayname["mon"] = 1;
    GGshortdayname["tue"] = 2;
    GGshortdayname["wed"] = 3;
    GGshortdayname["thu"] = 4;
    GGshortdayname["fri"] = 5;
    GGshortdayname["sat"] = 6;
    GGmonthname["jan"] = 0;
    GGmonthname["feb"] = 1;
    GGmonthname["mar"] = 2;
    GGmonthname["apr"] = 3;
    GGmonthname["may"] = 4;
    GGmonthname["jun"] = 5;
    GGmonthname["jul"] = 6;
    GGmonthname["aug"] = 7;
    GGmonthname["sep"] = 8;
    GGmonthname["oct"] = 9;
    GGmonthname["nov"] = 10;
    GGmonthname["dec"] = 11;
    // parse and convert the date
    for (;;) {
        if (WDrol == "") {
            break;
        }
        content = WDrol;
 	var re1 = /^([^ ]*) +(.*)$/; // monthname rest ?
	var result = re1.exec(WDrol);
	if (result == null) {
	    word = "";
	} else {
	    word = result[1];
            word = word.toLowerCase();
	    WDrol = result[2];
	}
	var dayn = word.substring(0,3); // dayname[+1]
	dayn = dayn.toLowerCase();
        if ((dow == -1) && (typeof(GGshortdayname[dayn]) != "undefined")) {
            dow = GGshortdayname[dayn];
	    var v = word.split("+");
	    if (typeof(v[1]) == "undefined") {
		offset = 0;
	    } else {
		offset = parseInt(v[1]);
            }
        } else if (typeof(GGmonthname[dayn]) != "undefined") {
            m = GGmonthname[dayn];
        } else if (word == "in") { // noise word
        } else {
            break;               // unrecognized word, starts text
        }
    } // for
    if (dow == -1) {
        alert("cal.js: can't parse weekday in " + WDline); // never got a weekday
    } else if (WDcalpage.month == m) { // right month
        // find out what the dow for the bom is
	var tbom = new Date(WDcalpage.year, WDcalpage.month, 1, 0, 0, 0, 0); // begin of month
        var tdow = tbom.getDay();
        lastday = GGdaysmo[WDcalpage.month];
        if (((WDcalpage.year%4) == 0) && WDcalpage.month == 1) {
            lastday++; // leap year
        }
        tnth = 0;
        for (d=1; d <= lastday; d++) {
            if (tdow == dow) {
                tnth++; // This is the Nth monday
                if ((WDnth == 0) // all mondays
                    || (WDnth == tnth) // .. or this is the wanted one
                    || ((WDnth == -1) && (d+7 > lastday))) { // or last
                    d = d + offset; // day after the Nth monday
                    if (d <= lastday) {
			addtobox(WDcalpage, d, content);
                    }
                    if (WDnth > 0) { // only one wanted, bail
                        break;
                    }
                } // if nth
            } // if tdow
            tdow = (tdow+1) % 7;
        } // for
    } // right month
} // weekday