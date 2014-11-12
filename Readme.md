ngPouch
=======

[PouchDB](http://pouchdb.com/) AngularJS adapter to monitor and manage replication status and 3-way data binding

PouchDB supports live ( or "continious") replication where changes are propogated between the two databases as the changes occur.
However, in the event of going offline, something will need to restart the replication process.  The [PouchDB guides on replication]([PouchDB](http://pouchdb.com/)
discuss the mechanics of catching the 'error' and retrying replication, and even demonstrate the sophisticated "exponential backoff"
technique.

Geoff Cox wrote a plugin [pouchdb-persist](https://github.com/redgeoff/pouchdb-persist) to solve this exact problem.

This component (ngPouch) provides a similar approach to maintaining fault-tolerant replication, but also publishes
 replication details to Angular's scope.  For example, it tracks (and publishes to the scope) how many un-replicated
 changes have occured locally, the connection status and connection attempts, when data is being sent and received.

ngPouch also provides mechanisms for 3-way data binding.  Its not exactly 3-way realtime binding (for good reason).  We
want to be smart about the commits to our database and not create un-necessary revisions.  For example, we don't want to
commit a revision to the database on every key stroke.

ngPouch doesn't provide any directives, but offers a handy 'publish' function to be used on controllers.  The publish function
is fired once on initial call and subsequently on each database change.  It is smart enough not to run itself while already running so
rapid fire replication doesn't cause awkward refreshing and flicker.

If the developer wants the data to "magicly refresh" then they bind it to the scope inside of ngPouch's publish procedure.  If they
want the data to be unbound to database changes (such as in populating and edit form) they simply bind it to the scope outside "as-normal".

ngPouch does not provide any magic for updating the pouch database from scope data or user interactions.  ngPouch discourages over
writing revisions as this is a common mistake.  It is quite simple however, to write revisions from scope data on user events such
as clicking the save button.

Future
======

I think it would be good architecture to split out the problem of 3-way data binding and fault tolerant replication and provider
cleaner well documented angular libraries.  Also the replication updates are applied to Angular's root scope which is not ideal.

Install
------------

* bower install ng-pouch --save

View Demo
-------------

[![Youtube Demo](http://img.youtube.com/vi/k-6SD2b0KOA/0.jpg)](http://www.youtube.com/watch?v=k-6SD2b0KOA)

Run Demo
---------------

Linux or Mac required to run pouchdb-server.

* git clone git@github.com:jrhicks/ngPouch.git

* cd ngPouch

* cd example

* npm install

* npm run db

* node app.js


LICENSE
------------------
The MIT License (MIT)

Copyright (c) 2014 Jeffrey Hicks @jrhicks

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

