///<reference path='..\services.ts' />

module ts.formatting {    

    var formattingScanner = createScanner(ScriptTarget.ES5, /*skipTrivia*/ false);

    export function formatOnEnter(position: number, sourceFile: SourceFile, options: FormatCodeOptions): TextChange[] {
        var line = sourceFile.getLineAndCharacterFromPosition(position).line - 1;
        // format current and previous lines
        var start = getStartOfLine(line - 1, sourceFile);
        var end = getEndOfLine(line, sourceFile);
        var span = new TypeScript.TextSpan(start, end - start);
        return formatSpan(span, sourceFile, options);
    }

    export function formatOnSemicolon(position: number, sourceFile: SourceFile, options: FormatCodeOptions): TextChange[]{
        return formatOutermostParent(position, SyntaxKind.SemicolonToken, sourceFile, options);
    }

    export function formatOnClosingCurly(position: number, sourceFile: SourceFile, options: FormatCodeOptions): TextChange[] {
        return formatOutermostParent(position, SyntaxKind.CloseBraceToken, sourceFile, options);
    }

    export function formatDocument(sourceFile: SourceFile, options: FormatCodeOptions): TextChange[] {
        var span = new TypeScript.TextSpan(0, sourceFile.text.length);
        return formatSpan(span, sourceFile, options);;
    }
    
    export function formatSelection(start: number, end: number, sourceFile: SourceFile, options: FormatCodeOptions): TextChange[] {
        var span = new TypeScript.TextSpan(start, end - start)
        return formatSpan(span, sourceFile, options);;
    }

    function getEndOfLine(line: number, sourceFile: SourceFile): number {
        var lineStarts = sourceFile.getLineStarts();
        if (line === lineStarts.length - 1) {
            // last line - return EOF - <start pos of line>
            return sourceFile.text.length - lineStarts[line];
        }
        else {
            var start = lineStarts[line];
            var pos = lineStarts[line + 1] - 1;
            while (start >= pos && isLineBreak(sourceFile.text.charCodeAt(pos))) {
                pos--;
            }
            return pos;
        }
    }

    function getStartOfLine(line: number, sourceFile: SourceFile): number {
        return sourceFile.getLineStarts()[line];
    }

    function formatOutermostParent(position: number, expectedLastToken: SyntaxKind, sourceFile: SourceFile, options: FormatCodeOptions): TextChange[]{
        var parent = findOutermostParent(position, expectedLastToken, sourceFile);
        if (!parent) {
            return undefined;
        }
        var start = parent.getStart(sourceFile);
        var span = new TypeScript.TextSpan(start, parent.end - start);
        return formatSpan(span, sourceFile, options);
    }

    function findOutermostParent(position: number, expectedTokenKind: SyntaxKind, sourceFile: SourceFile): Node {
        var precedingToken = ServicesSyntaxUtilities.findPrecedingToken(position, sourceFile);
        if (!precedingToken || precedingToken.kind !== expectedTokenKind) {
            return undefined;
        }

        // walk up and search for the parent node that ends at the same position with precedingToken
        var current = precedingToken;
        while (current &&
               current.parent &&
               current.parent.end === precedingToken.end &&
               !isListElement(current.parent, current)  ) {
            current = current.parent;
        }

        return current;
    }

    function nodeArrayContainsNode<T>(nodeArray: NodeArray<T>, node: Node): boolean {
        return nodeArray.pos <= node.pos && nodeArray.end >= node.end;
    }

    function nodeContainsSpan(n: Node, span: TypeScript.TextSpan): boolean {
        return n.pos <= span.start() && n.end >= span.end();
    }

    function isListElement(parent: Node, node: Node): boolean {
        switch (parent.kind) {            
            case SyntaxKind.ClassDeclaration:
            case SyntaxKind.InterfaceDeclaration:
                return nodeArrayContainsNode((<InterfaceDeclaration>parent).members, node);
            case SyntaxKind.ModuleDeclaration:
                var body = (<ModuleDeclaration>parent).body;
                return body && body.kind === SyntaxKind.Block && nodeArrayContainsNode((<Block>body).statements, node);
            case SyntaxKind.SourceFile:
            case SyntaxKind.Block:
            case SyntaxKind.TryBlock:
            case SyntaxKind.CatchBlock:
            case SyntaxKind.FinallyBlock:
            case SyntaxKind.ModuleBlock:
                return nodeArrayContainsNode((<Block>parent).statements, node)
        }
    }

    function findEnclosingNode(span: TypeScript.TextSpan, sourceFile: SourceFile): Node {
        return find(sourceFile);

        function find(n: Node): Node {
            Debug.assert(nodeContainsSpan(n, span));
            var candidate = forEachChild(n, c => nodeContainsSpan(c, span) && c);
            return (candidate && find(candidate)) || n;
        }
    }

    function getIndentationForNode(n: Node, sourceFile: SourceFile, options: FormatCodeOptions): number {
        var start = sourceFile.getLineAndCharacterFromPosition(n.getStart(sourceFile));
        return SmartIndenter.getIndentationForNode(n, start, /*indentationDelta*/ 0, sourceFile, options);
    }

    function formatSpan(span: TypeScript.TextSpan, sourceFile: SourceFile, options: FormatCodeOptions): TextChange[] {
        var enclosingNode = findEnclosingNode(span, sourceFile);
        var initialIndentation = getIndentationForNode(enclosingNode, sourceFile, options);

        formattingScanner.setText(sourceFile.text);
        formattingScanner.setTextPos(enclosingNode.pos);

        return undefined;
    }
}