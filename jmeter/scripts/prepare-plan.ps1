param(
  [Parameter(Mandatory = $true)]
  [string]$InputJmx,

  [Parameter(Mandatory = $true)]
  [ValidateSet('debug', 'perf')]
  [string]$Mode,

  [Parameter(Mandatory = $false)]
  [string]$OutputJmx
)

$ErrorActionPreference = 'Stop'

function Get-DefaultOutputPath {
  param([string]$InPath, [string]$ModeName)
  $dir = Split-Path -Parent $InPath
  $base = [System.IO.Path]::GetFileNameWithoutExtension($InPath)
  $outName = "${base}_${ModeName}.jmx"
  return Join-Path $dir $outName
}

$inFull = Resolve-Path -LiteralPath $InputJmx
$outPath = if ($OutputJmx) { $OutputJmx } else { Get-DefaultOutputPath -InPath $inFull -ModeName $Mode }

[xml]$xml = Get-Content -LiteralPath $inFull -Raw

$viewTreeNodes = $xml.SelectNodes("//ResultCollector[@testclass='ResultCollector' and @guiclass='ViewResultsFullVisualizer']")
foreach ($node in $viewTreeNodes) {
  $node.SetAttribute('enabled', ($Mode -eq 'debug').ToString().ToLowerInvariant())

  if ($Mode -eq 'perf') {
    $saveConfig = $node.SelectSingleNode("objProp[@name='saveConfig']/value[@class='SampleSaveConfiguration']")
    if ($saveConfig) {
      $samplerData = $saveConfig.SelectSingleNode("samplerData")
      if ($samplerData) { $samplerData.InnerText = 'false' }
      $requestHeaders = $saveConfig.SelectSingleNode("requestHeaders")
      if ($requestHeaders) { $requestHeaders.InnerText = 'false' }
      $responseHeaders = $saveConfig.SelectSingleNode("responseHeaders")
      if ($responseHeaders) { $responseHeaders.InnerText = 'false' }
      $responseDataOnError = $saveConfig.SelectSingleNode("responseDataOnError")
      if ($responseDataOnError) { $responseDataOnError.InnerText = 'false' }
    }
  }
}

$xml.Save($outPath)

Write-Host ("Generated: {0}" -f $outPath)
