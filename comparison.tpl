<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Diff.Pics</title>
    <meta name="description" content="">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="http://fonts.googleapis.com/css?family=Open+Sans:400,300,700">
    <link rel="stylesheet" href="static/view.css">
    <script>COMPARISONS = {{!comparisons}}</script>
  </head>
  <body>
    <h1>{{title}}</h1>

    <div id="selector"></div>

    <div id="comparison">
      <h2 id="filename">
        <span id="main"></span>
        <span id="hover"></span>
      </h2>
      <img src="">
    </div>

    <div id="preload">
      <h1>Loading...</h1>
    </div>

    <div id="footer">
      Submit feedback on <a href="https://github.com/Fugiman/diff.pics/issues">Github</a> or <a href="https://twitter.com/fugiman">Twitter</a>
    </div>

    <script src="http://code.jquery.com/jquery-2.1.3.min.js"></script>
    <script src="//cdnjs.cloudflare.com/ajax/libs/ICanHaz.js/0.10.3/ICanHaz.min.js"></script>
    <script src="//cdnjs.cloudflare.com/ajax/libs/lodash.js/3.2.0/lodash.min.js"></script>
    <script src="static/rsvp.js"></script>
    <script src="static/view.js"></script>

    <script>
      (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
      (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
      m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
      })(window,document,'script','//www.google-analytics.com/analytics.js','ga');

      ga('create', 'UA-59995668-1', 'auto');
      ga('send', 'pageview');
    </script>
  </body>
</html>
