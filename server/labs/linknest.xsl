<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/linknest">
    <html><head><meta charset="UTF-8"/><title>Pinpoint export</title><style>body{font:16px system-ui;max-width:760px;margin:40px auto;padding:0 20px;color:#302b43}li{padding:10px;border:1px solid #eee;border-radius:8px;margin:8px 0}small{color:#777}</style></head><body>
      <h1><xsl:value-of select="profile/displayName"/></h1><p><xsl:value-of select="profile/bio"/></p><h2>Links</h2><ul><xsl:for-each select="links/link"><li><strong><xsl:value-of select="title"/></strong><br/><code><xsl:value-of select="destinationUrl"/></code><br/><small><xsl:value-of select="description"/></small></li></xsl:for-each></ul>
    </body></html>
  </xsl:template>
</xsl:stylesheet>
