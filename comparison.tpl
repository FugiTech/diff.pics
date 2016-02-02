<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Diff.Pics - {{title}}</title>
    <meta name="description" content="">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="twitter:card" content="photo">
    <meta name="twitter:title" content="{{title}}">
    <meta name="twitter:image" content="{{image}}">
    <meta name="twitter:url" content="{{url}}">
    <link rel="stylesheet" href="http://fonts.googleapis.com/css?family=Open+Sans:400,300,700">
    <link rel="stylesheet" href="/static/view.css">
    <script>COMPARISONS = {{!comparisons}}</script>
  </head>
  <body>
    <h1>{{title}}</h1>
    <a id="download" href="#" onclick="return window.download()"></a>

    <div id="selector"></div>
    <div id="subselector"></div>

    <div id="comparison">
      <h2 id="filename">
        <span id="main"></span>
        <span id="hover"></span>
      </h2>
      <img src="">
    </div>

    <div id="preload"><h1></h1></div>

    <div id="footer"></div>

    <script src="http://code.jquery.com/jquery-2.1.3.min.js"></script>
    <script src="//cdnjs.cloudflare.com/ajax/libs/ICanHaz.js/0.10.3/ICanHaz.min.js"></script>
    <script src="//cdnjs.cloudflare.com/ajax/libs/lodash.js/3.5.0/lodash.min.js"></script>
    <script src="//cdnjs.cloudflare.com/ajax/libs/URI.js/1.11.2/URI.min.js"></script>
    <script src="/static/jszip.min.js"></script>
    <script src="/static/rsvp.js"></script>
    <script src="/static/translations.js"></script>
    <script src="/static/view.js"></script>

    <script>
      (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
      (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
      m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
      })(window,document,'script','//www.google-analytics.com/analytics.js','ga');

      ga('create', 'UA-59995668-1', 'auto');
      ga('send', 'pageview');
    </script>
    <script>
      (function(w,d,s,i,u,a,k,n,e,p){w[n]=w[n]||[];
      e=d.createElement(s);e.async=1;e.id=i;e.setAttribute(a,k);e.src=u;
      m=d.getElementsByTagName(s)[0];m.parentNode.insertBefore(e,m);})
      (window,document,'script','gauges-tracker','//secure.gaug.es/track.js','data-site-id','5528e2fcde2e263309000e22','_gauges');
    </script>
  </body>
</html>

<script id="subselect" type="text/html">
  <div class="subselect">
    <span class="number">{{"{{number}}"}}</span>
    &nbsp;
    <span class="name">{{"{{name}}"}}</span>
  </div>
</script>
