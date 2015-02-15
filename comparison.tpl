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

    <script src="http://code.jquery.com/jquery-2.1.3.min.js"></script>
    <script src="//cdnjs.cloudflare.com/ajax/libs/ICanHaz.js/0.10.3/ICanHaz.min.js"></script>
    <script src="//cdnjs.cloudflare.com/ajax/libs/lodash.js/3.2.0/lodash.min.js"></script>
    <script src="static/rsvp.js"></script>
    <script src="static/view.js"></script>
  </body>
</html>
