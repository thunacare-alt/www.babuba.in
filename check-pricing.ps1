Start-Sleep -Seconds 40
$css = (Invoke-WebRequest -Uri 'https://www.babuba.in/style.css' -UseBasicParsing).Content
Write-Output ('stacked-rules=' + $css.Contains('SAAS SUBSCRIPTION'))
Write-Output ('overflow-visible=' + $css.Contains('.own-compare { overflow: visible; }'))
