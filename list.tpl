<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Diff.Pics - List</title>
    <meta name="description" content="">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="http://fonts.googleapis.com/css?family=Open+Sans:400,300,700">
    <link rel="stylesheet" href="/static/list.css">
  </head>
  <body>
    <h1>{{amount}} comparisons with {{total_views}} views</h1>
      % for comparison in comparisons:
      <p>
        <a href="/{{comparison["key"]}}">
          <span>{{comparison["title"] or "No Title"}}</span>
          <em>{{"{:,d}".format(int(comparison["views"] or 0))}}</em>
        </a>
      </p>
      % end

    <div id="footer"></div>

    <script src="http://code.jquery.com/jquery-2.1.3.min.js"></script>
    <script src="//cdnjs.cloudflare.com/ajax/libs/ICanHaz.js/0.10.3/ICanHaz.min.js"></script>
    <script src="//cdnjs.cloudflare.com/ajax/libs/lodash.js/3.5.0/lodash.min.js"></script>
    <script src="//cdnjs.cloudflare.com/ajax/libs/URI.js/1.11.2/URI.min.js"></script>
    <script src="/static/rsvp.js"></script>
    <script src="/static/translations.js"></script>
    <script>$(function () { $("#footer").html(ich.footer({ "github": '<a href="https://github.com/Fugiman/diff.pics/issues">Github</a>', "twitter": '<a href="https://twitter.com/fugiman">Twitter</a>' })); });</script>

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
