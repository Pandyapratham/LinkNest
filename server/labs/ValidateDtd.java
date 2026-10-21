import java.io.StringReader;
import java.nio.file.Files;
import java.nio.file.Path;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import org.xml.sax.InputSource;
import org.xml.sax.SAXException;

/** Validates the bundled sample with only the project's fixed local DTD. */
public class ValidateDtd {
  public static void main(String[] args) throws Exception {
    Path dtd = Path.of("server", "schemas", "linknest.dtd").toAbsolutePath().normalize();
    Path sample = Path.of("server", "labs", "sample-linknest.xml").toAbsolutePath().normalize();
    String xml = Files.readString(sample);
    int declarationEnd = xml.startsWith("<?xml") ? xml.indexOf("?>") + 2 : 0;
    xml = xml.substring(0, declarationEnd) + "\n<!DOCTYPE linknest SYSTEM \"linknest.dtd\">\n" + xml.substring(declarationEnd);
    DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
    factory.setValidating(true);
    factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
    factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
    factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
    factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
    factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
    var builder = factory.newDocumentBuilder();
    builder.setEntityResolver((publicId, systemId) -> {
      if (systemId != null && systemId.endsWith("linknest.dtd")) return new InputSource(Files.newInputStream(dtd));
      throw new SAXException("External XML resources are disabled.");
    });
    builder.setErrorHandler(new org.xml.sax.helpers.DefaultHandler() {
      @Override public void error(org.xml.sax.SAXParseException exception) throws SAXException { throw exception; }
      @Override public void fatalError(org.xml.sax.SAXParseException exception) throws SAXException { throw exception; }
    });
    builder.parse(new InputSource(new StringReader(xml)));
    System.out.println("Sample XML is valid against the bundled local DTD.");
  }
}
